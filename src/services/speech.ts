import type { Locale } from '../locales'

export type SpeechIssue = 'unsupported' | 'denied' | 'timeout' | 'emptySpeech' | 'speechLanguage' | 'speechError' | 'speechInterrupted'
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
  onspeechend: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
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
  listen(locale: Locale, callbacks: {
    started(): void
    sound(active: boolean): void
    processing(): void
    recognized(transcript: string): void
    failed(issue: SpeechIssue): void
  }): { stop(): void; cancel(): void }
}

function recognitionConstructor() {
  const browser = window as RecognitionWindow
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export const speechToText: SpeechToTextProvider = {
  available: () => Boolean(recognitionConstructor()),
  listen(locale, callbacks) {
    let session: Recognition | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let finished = false
    let phase: 'starting' | 'listening' | 'processing' = 'starting'
    const started = () => {
      if (finished || phase !== 'starting') return
      phase = 'listening'
      callbacks.started()
    }
    const processing = () => {
      if (finished || phase === 'processing') return
      phase = 'processing'
      callbacks.processing()
    }
    const sound = (active: boolean) => {
      if (!finished && phase === 'listening') callbacks.sound(active)
    }
    const finish = () => {
      if (finished) return false
      finished = true
      clearTimeout(timer)
      return true
    }
    const abort = () => {
      try { session?.abort() } catch { /* The browser may already have ended recognition. */ }
    }
    const fail = (issue: SpeechIssue) => {
      if (!finish()) return
      abort()
      callbacks.failed(issue)
    }
    const stop = () => {
      if (finished || !session || phase === 'processing') return
      processing()
      try { session.stop() } catch { fail('speechError') }
    }
    const cancel = () => {
      if (finish()) abort()
    }
    const API = recognitionConstructor()
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
      session.onstart = started
      session.onaudiostart = started
      session.onsoundstart = () => sound(true)
      session.onsoundend = () => sound(false)
      session.onspeechend = processing
      session.onaudioend = processing
      session.onresult = event => {
        const transcript = event.results[0]?.[0]?.transcript.trim()
        if (!transcript) fail('emptySpeech')
        else if (finish()) callbacks.recognized(transcript)
      }
      session.onend = () => fail('emptySpeech')
      session.onerror = ({ error }) => {
        if (error === 'not-allowed' || error === 'service-not-allowed') fail('denied')
        else if (error === 'no-speech') fail('emptySpeech')
        else if (error === 'language-not-supported') fail('speechLanguage')
        else if (error === 'aborted') fail('speechInterrupted')
        else fail('speechError')
      }
      timer = setTimeout(() => fail('timeout'), 12_000)
      session.start()
    } catch (error) {
      const issue = error instanceof DOMException && ['SecurityError', 'NotAllowedError'].includes(error.name) ? 'denied' : 'speechError'
      queueMicrotask(() => fail(issue))
    }
    return { stop, cancel }
  },
}
