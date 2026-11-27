import { useSyncExternalStore } from 'react'
import type { Locale } from '../locales'
import { recognitionSupport } from '../services/speech'
import { clearSpeechDiagnostics, speechDiagnosticSnapshot, subscribeSpeechDiagnostics } from '../services/speechDiagnostics'

export function SpeechDiagnostics({ locale }: { locale: Locale }) {
  const entries = useSyncExternalStore(subscribeSpeechDiagnostics, speechDiagnosticSnapshot)
  return <details className="panel speech-diagnostics" open>
    <summary>Speech diagnostics (development)</summary>
    <p>Interface {locale} · Recognition API {recognitionSupport()} · {window.isSecureContext ? 'Secure context' : 'Insecure context'}</p>
    <p>Use test phrases. This page keeps event metadata in memory until it reloads.</p>
    <button className="button" type="button" onClick={clearSpeechDiagnostics}>Clear diagnostics</button>
    <pre tabIndex={0} aria-label="Speech event log">{entries.map(entry => {
      const result = entry.transcriptReturned === undefined ? '' : ` · transcript returned ${entry.transcriptReturned ? 'yes' : 'no'}`
      const error = entry.errorCode ? ` · ${entry.errorCode}${entry.errorMessage ? ` · ${entry.errorMessage}` : ''}` : ''
      return `${entry.time} #${entry.session} ${entry.event} · ${entry.phase} · UI ${entry.interfaceLocale} → ${entry.requestedLocale} · ${entry.api}${result}${error}`
    }).join('\n')}</pre>
  </details>
}
