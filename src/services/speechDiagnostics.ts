import type { Locale } from '../locales'

export type RecognitionAPI = 'standard' | 'webkit' | 'unavailable'
export type SpeechPhase = 'starting' | 'listening' | 'processing' | 'finishing' | 'closed'

type EventName = 'request' | 'start' | 'audiostart' | 'soundstart' | 'speechstart' | 'audioend' | 'speechend' | 'result' |
  'nomatch' | 'error' | 'end' | 'cancel' | 'timeout' | 'close'
type TraceEntry = {
  event: EventName
  session: number
  interfaceLocale: Locale
  requestedLocale: Locale
  phase: SpeechPhase
  api: RecognitionAPI
  transcriptReturned?: boolean
  errorCode?: string
  errorMessage?: string
}
type TimedEntry = TraceEntry & { time: string }

let entries: readonly TimedEntry[] = []
const listeners = new Set<() => void>()

export function speechDebugEnabled() {
  return import.meta.env.DEV && typeof window !== 'undefined' &&
    new URLSearchParams(window.location?.search ?? '').get('speech-debug') === '1'
}

export function recordSpeechEvent(entry: TraceEntry) {
  if (!speechDebugEnabled()) return
  // Diagnostic history is capped, in memory only, and never includes result text.
  entries = [...entries.slice(-47), { ...entry, time: new Date().toISOString().slice(11, 23) }]
  listeners.forEach(listener => listener())
}

export function subscribeSpeechDiagnostics(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function speechDiagnosticSnapshot() { return entries }

export function clearSpeechDiagnostics() {
  entries = []
  listeners.forEach(listener => listener())
}
