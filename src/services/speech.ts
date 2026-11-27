import type { Locale } from '../locales'

export type SpeechIssue = 'unsupported' | 'denied' | 'timeout' | 'emptySpeech' | 'speechLanguage' | 'speechError'
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
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
    processing(): void
    recognized(transcript: string): void
    failed(issue: SpeechIssue): void
  }): { stop(): void; cancel(): void }
}
export interface TextToSpeechProvider {
  speak(text: string, locale: Locale): boolean
  cancel(): void
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
      if (finished || !session) return
      callbacks.processing()
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
      session.onspeechend = () => { if (!finished) callbacks.processing() }
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

export const textToSpeech: TextToSpeechProvider = {
  speak(text, locale) {
    const synthesis = window.speechSynthesis
    if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') return false
    const voices = synthesis.getVoices()
    const language = locale.toLowerCase()
    const voice = voices.find(item => item.lang.toLowerCase() === language) ??
      voices.find(item => item.lang.toLowerCase().split(/[-_]/)[0] === language.split('-')[0])
    if (!voice) return false
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    synthesis.cancel()
    synthesis.speak(utterance)
    return true
  },
  cancel: () => window.speechSynthesis?.cancel(),
}
