// Cloud speech-to-text client using the BolHaq backend proxy.
// No Sarvam credentials are present in this file.

export type CloudSpeechLocale = 'hi-IN' | 'ml-IN'
export type CloudSpeechResult =
  | { status: 'transcript'; text: string }
  | { status: 'error'; code: 'quota' | 'disabled' | 'timeout' | 'format' | 'size' | 'server' | 'network' }

const CLOUD_ENDPOINT = '/api/speech/transcribe'

// Supported recording MIME types in preference order for Indian-language audio.
// AAC/mp4 is the only format reliably supported on iOS Safari.
// Opus/webm is preferred on Android and desktop Chrome.
const PREFERRED_TYPES = [
  'audio/mp4',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

export function supportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return PREFERRED_TYPES.find(type => MediaRecorder.isTypeSupported(type))
}

export function cloudSpeechAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined' && supportedMimeType() !== undefined
}

export async function transcribeBlob(
  blob: Blob,
  locale: CloudSpeechLocale,
  signal: AbortSignal,
): Promise<CloudSpeechResult> {
  const form = new FormData()
  form.append('audio', blob, `recording.${mimeToExtension(blob.type)}`)
  form.append('locale', locale)

  try {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: 'POST',
      body: form,
      signal,
    })

    if (!response.ok) {
      const code = errorCodeFromStatus(response.status)
      return { status: 'error', code }
    }

    const json = await response.json() as unknown
    if (!isTranscriptResponse(json)) return { status: 'error', code: 'server' }
    return { status: 'transcript', text: json.transcript }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', code: 'timeout' }
    }
    return { status: 'error', code: 'network' }
  }
}

function mimeToExtension(mime: string): string {
  if (mime.startsWith('audio/mp4') || mime.startsWith('audio/aac')) return 'm4a'
  if (mime.startsWith('audio/webm')) return 'webm'
  if (mime.startsWith('audio/ogg')) return 'ogg'
  return 'bin'
}

function errorCodeFromStatus(status: number): CloudSpeechResult & { status: 'error' } extends { code: infer C } ? C : never {
  if (status === 429) return 'quota'
  if (status === 503 || status === 404) return 'disabled'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 400 || status === 413 || status === 415) return 'format'
  return 'server'
}

function isTranscriptResponse(value: unknown): value is { transcript: string } {
  return (
    typeof value === 'object' && value !== null &&
    'transcript' in value && typeof (value as Record<string, unknown>).transcript === 'string'
  )
}

// Cloud recording session controller.
// Manages MediaRecorder lifecycle, AudioContext VAD, enforces limits, and handles cleanup.
export interface CloudRecordingCallbacks {
  started(): void
  sound?(active: boolean): void
  tick(elapsedMs: number): void
  stopped(blob: Blob, durationMs: number): void
  failed(reason: 'permission' | 'format' | 'hardware' | 'interrupted' | 'emptySpeech'): void
}

export const MAX_RECORDING_MS = 8_000
export const INITIAL_SILENCE_TIMEOUT_MS = 3_500
export const SPEECH_TRAILING_SILENCE_MS = 1_300

export function startCloudRecording(
  mimeType: string,
  callbacks: CloudRecordingCallbacks,
): { stop(): void; cancel(): void } {
  let recorder: MediaRecorder | undefined
  let stream: MediaStream | undefined
  let audioContext: AudioContext | undefined
  let analyser: AnalyserNode | undefined
  let vadTimer: ReturnType<typeof setInterval> | undefined
  let chunks: BlobPart[] = []
  let startTime = 0
  let tickTimer: ReturnType<typeof setInterval> | undefined
  let capTimer: ReturnType<typeof setTimeout> | undefined
  let initialSilenceTimer: ReturnType<typeof setTimeout> | undefined
  let trailingSilenceTimer: ReturnType<typeof setTimeout> | undefined
  let hasSpoken = false
  let done = false

  function releaseResources() {
    clearInterval(tickTimer)
    clearInterval(vadTimer)
    clearTimeout(capTimer)
    clearTimeout(initialSilenceTimer)
    clearTimeout(trailingSilenceTimer)
    try { audioContext?.close() } catch { /* Ignore */ }
    audioContext = undefined
    analyser = undefined
    stream?.getTracks().forEach(track => track.stop())
    stream = undefined
  }

  function finish(blob?: Blob, durationMs?: number) {
    if (done) return
    done = true
    releaseResources()
    if (blob && durationMs !== undefined) {
      if (blob.size === 0) {
        callbacks.failed('emptySpeech')
      } else {
        callbacks.stopped(blob, durationMs)
      }
    }
  }

  function cancel() {
    if (done) return
    done = true
    releaseResources()
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* Already stopped. */ }
    }
  }

  function stop() {
    if (done || !recorder || recorder.state !== 'recording') return
    clearTimeout(capTimer)
    clearTimeout(initialSilenceTimer)
    clearTimeout(trailingSilenceTimer)
    try { recorder.stop() } catch { /* Already stopped. */ }
  }

  // Setup Web Audio VAD for automatic speech end detection
  function setupVAD(audioStream: MediaStream) {
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    try {
      audioContext = new AudioCtx()
      const source = audioContext.createMediaStreamSource(audioStream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const threshold = 18 // Adaptive voice activity threshold

      vadTimer = setInterval(() => {
        if (done || !analyser) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        const isSpeaking = average > threshold

        callbacks.sound?.(isSpeaking)

        if (isSpeaking) {
          if (!hasSpoken) {
            hasSpoken = true
            clearTimeout(initialSilenceTimer)
          }
          clearTimeout(trailingSilenceTimer)
        } else if (hasSpoken) {
          // If speech was previously active and now dropped below threshold,
          // wait for trailing silence window before auto-stopping
          if (!trailingSilenceTimer) {
            trailingSilenceTimer = setTimeout(() => {
              stop()
            }, SPEECH_TRAILING_SILENCE_MS)
          }
        }
      }, 80)
    } catch {
      // AudioContext unavailable or blocked: graceful fallback to manual stop and cap timer
    }
  }

  void navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(s => {
    if (done) {
      s.getTracks().forEach(t => t.stop())
      return
    }
    stream = s
    try {
      recorder = new MediaRecorder(s, { mimeType })
    } catch {
      releaseResources()
      callbacks.failed('format')
      return
    }
    chunks = []
    startTime = Date.now()

    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    recorder.onstart = () => {
      callbacks.started()
      setupVAD(s)

      tickTimer = setInterval(() => {
        callbacks.tick(Date.now() - startTime)
      }, 100)

      capTimer = setTimeout(() => stop(), MAX_RECORDING_MS)

      // Initial silence timer: if no speech begins within 3.5s, finish/stop
      initialSilenceTimer = setTimeout(() => {
        if (!hasSpoken) {
          stop()
        }
      }, INITIAL_SILENCE_TIMEOUT_MS)
    }

    recorder.onstop = () => {
      clearInterval(tickTimer)
      clearInterval(vadTimer)
      clearTimeout(capTimer)
      clearTimeout(initialSilenceTimer)
      clearTimeout(trailingSilenceTimer)
      const durationMs = Date.now() - startTime
      const blob = new Blob(chunks, { type: mimeType })
      finish(blob, durationMs)
    }

    recorder.onerror = () => {
      if (!done) { done = true; releaseResources(); callbacks.failed('hardware') }
    }

    recorder.start(250) // collect in 250 ms chunks
  }).catch((error: unknown) => {
    if (done) return
    const name = error instanceof DOMException ? error.name : ''
    done = true
    callbacks.failed(name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'hardware')
  })

  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.hidden && !done) { done = true; releaseResources(); callbacks.failed('interrupted') }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  return {
    stop,
    cancel() {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      cancel()
    },
  }
}
