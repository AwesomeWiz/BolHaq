import type { Locale } from '../locales'
import { recordSpeechEvent } from './speechDiagnostics'
import type { RecognitionAPI, SpeechPhase } from './speechDiagnostics'

export type SpeechIssue = 'unsupported' | 'denied' | 'timeout' | 'emptySpeech' | 'speechLanguage' |
  'speechError' | 'speechInterrupted' | 'speechUnavailable' | 'speechCapture' | 'speechServiceBlocked' | 'speechNoResult'

type Result = ArrayLike<{ transcript: string }> & { isFinal?: boolean }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onsoundstart: (() => void) | null
  onsoundend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onend: (() => void) | null
  onnomatch: (() => void) | null
  onerror: ((event: { error: string; message?: string }) => void) | null
  onresult: ((event: { resultIndex?: number; results: ArrayLike<Result> }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export interface SpeechToTextProvider {
  available(): boolean
  cancel(): void
  listen(locale: Locale, callbacks: {
    started(): void
    sound(active: boolean): void
    processing(): void
    recognized(transcript: string): void
    failed(issue: SpeechIssue): void
  }): { stop(): void; cancel(): void }
}

function recognitionOption() {
  const browser = window as RecognitionWindow
  const API = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  const name: RecognitionAPI = browser.SpeechRecognition ? 'standard' : API ? 'webkit' : 'unavailable'
  return { API, name }
}

export function recognitionSupport() { return recognitionOption().name }

function browserIssue(code: string): SpeechIssue {
  switch (code) {
    case 'not-allowed': case 'NotAllowedError': case 'SecurityError': return 'denied'
    case 'language-not-supported': return 'speechLanguage'
    case 'service-not-allowed': case 'network': return 'speechUnavailable'
    case 'audio-capture': case 'NotReadableError': return 'speechCapture'
    case 'no-speech': return 'emptySpeech'
    case 'aborted': case 'AbortError': return 'speechInterrupted'
    default: return 'speechError'
  }
}

const lateResultWindowMs = 200
let lastSession = 0
let cancelActive: (() => void) | undefined

export const speechToText: SpeechToTextProvider = {
  available: () => recognitionSupport() !== 'unavailable',
  cancel: () => cancelActive?.(),
  listen(locale, callbacks) {
    cancelActive?.()
    const { API, name } = recognitionOption()
    const id = ++lastSession
    let session: Recognition | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let phase: SpeechPhase = 'starting'
    let ended = false

    function report(event: Parameters<typeof recordSpeechEvent>[0]['event'],
      detail?: Partial<Pick<Parameters<typeof recordSpeechEvent>[0], 'transcriptReturned' | 'errorCode' | 'errorMessage'>>) {
      if (import.meta.env.DEV) recordSpeechEvent({
        event, session: id, interfaceLocale: locale, requestedLocale: locale, phase, api: name, ...detail,
      })
    }

    function detach(instance: Recognition, keepEnd = false) {
      instance.onstart = instance.onaudiostart = instance.onaudioend =
        instance.onsoundstart = instance.onsoundend = instance.onspeechstart =
        instance.onspeechend = instance.onnomatch = instance.onresult = instance.onerror = null
      if (!keepEnd) instance.onend = null
    }

    function close(abort: boolean) {
      if (phase === 'closed') return
      phase = 'closed'
      clearTimeout(timer)
      const instance = session
      session = undefined
      if (cancelActive === cancel) cancelActive = undefined
      if (instance) {
        detach(instance)
        if (abort) {
          try { instance.abort() } catch { /* The browser can already have released recognition. */ }
        }
      }
      report('close')
    }

    function fail(issue: SpeechIssue, abort = true) {
      if (phase === 'closed' || phase === 'finishing') return
      close(abort)
      callbacks.failed(issue)
    }

    function awaitEnd() {
      if (ended) { close(false); return }
      const instance = session
      if (!instance) return
      phase = 'finishing'
      clearTimeout(timer)
      // Only the browser end event is relevant after a terminal result or error.
      detach(instance, true)
      timer = setTimeout(() => close(true), 1000)
    }

    function cancel() {
      if (phase === 'closed') return
      report('cancel')
      close(true)
    }

    function started(event: 'start' | 'audiostart') {
      if (phase === 'closed' || phase === 'finishing') return
      report(event)
      if (phase !== 'starting') return
      phase = 'listening'
      callbacks.started()
    }

    function captureEnded(event: 'audioend' | 'speechend') {
      if (phase === 'closed' || phase === 'finishing') return
      report(event)
      processing()
    }

    function processing() {
      if (phase === 'closed' || phase === 'finishing' || phase === 'processing') return
      phase = 'processing'
      callbacks.processing()
    }

    function startFailed(error: unknown) {
      const code = error instanceof Error ? error.name : 'start-failed'
      // Browser-provided error descriptions are displayed in memory only.
      report('error', { errorCode: code, errorMessage: error instanceof Error ? error.message.slice(0, 240) : undefined })
      fail(browserIssue(code))
    }

    function stop() {
      if (!session || phase !== 'listening') return
      processing()
      try { session.stop() } catch (error) { startFailed(error) }
    }

    cancelActive = cancel
    report('request')
    if (!API) {
      queueMicrotask(() => fail('unsupported'))
      return { stop, cancel }
    }

    try {
      session = new API()
      session.lang = locale
      session.continuous = false
      session.interimResults = false
      session.maxAlternatives = 1
      session.onstart = () => started('start')
      session.onaudiostart = () => started('audiostart')
      session.onsoundstart = () => {
        if (phase === 'closed' || phase === 'finishing') return
        report('soundstart')
        if (phase === 'listening') callbacks.sound(true)
      }
      session.onsoundend = () => { if (phase === 'listening') callbacks.sound(false) }
      session.onspeechstart = () => { if (phase !== 'closed' && phase !== 'finishing') report('speechstart') }
      session.onspeechend = () => captureEnded('speechend')
      session.onaudioend = () => captureEnded('audioend')
      session.onresult = event => {
        if (phase === 'closed' || phase === 'finishing') return
        let transcript = ''
        let hasFinal = false
        let transcriptReturned = false
        for (let index = event.resultIndex ?? 0; index < event.results.length; index++) {
          const result = event.results[index]
          const text = result?.[0]?.transcript.trim()
          if (text) transcriptReturned = true
          if (result?.isFinal === false) continue
          hasFinal = true
          if (text) transcript += (transcript ? ' ' : '') + text
        }
        report('result', { transcriptReturned })
        if (!hasFinal && event.results.length) return
        awaitEnd()
        if (transcript) callbacks.recognized(transcript)
        else callbacks.failed('emptySpeech')
      }
      session.onnomatch = () => {
        if (phase === 'closed' || phase === 'finishing') return
        report('nomatch', { transcriptReturned: false })
        awaitEnd()
        callbacks.failed('emptySpeech')
      }
      session.onend = () => {
        if (phase === 'closed' || ended) return
        ended = true
        report('end')
        if (phase === 'finishing') { close(false); return }
        // Keep handlers briefly for a final result or error queued around disconnection.
        clearTimeout(timer)
        processing()
        timer = setTimeout(() => fail('speechNoResult', false), lateResultWindowMs)
      }
      session.onerror = ({ error, message }) => {
        if (phase === 'closed' || phase === 'finishing') return
        report('error', { errorCode: error, errorMessage: message?.slice(0, 240) })
        awaitEnd()
        callbacks.failed(locale === 'ml-IN' && error === 'service-not-allowed' ? 'speechServiceBlocked' : browserIssue(error))
      }
      timer = setTimeout(() => { report('timeout'); fail('timeout') }, 12_000)
      session.start()
    } catch (error) {
      queueMicrotask(() => { if (phase !== 'closed') startFailed(error) })
    }
    return { stop, cancel }
  },
}
