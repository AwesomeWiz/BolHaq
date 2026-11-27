import { useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Keyboard, Mic, Square } from 'lucide-react'
import type { Messages } from '../locales/en'

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'awaiting' | 'success' | 'error'
export type VoiceFeedback = { status: VoiceStatus; message?: keyof Messages; reply?: string; transcript?: string }

export function VoicePanel({ t, examples, feedback, ready, available, onMic, onCommand }: {
  t: Messages
  examples: readonly string[]
  feedback: VoiceFeedback
  ready: boolean
  available: boolean
  onMic(): void
  onCommand(command: string): void
}) {
  const [typed, setTyped] = useState(false)
  const [command, setCommand] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const listening = feedback.status === 'listening'
  const processing = feedback.status === 'processing'
  const busy = listening || processing
  const message = feedback.message ? t[feedback.message] : feedback.reply ??
    (feedback.status === 'idle' ? (available ? '' : t.unsupported) : feedback.status === 'error' ? t.unknown : t[feedback.status])

  return <section className="voice-panel" aria-labelledby="voice-title" data-state={feedback.status}>
    <div className="voice-copy">
      <h2 id="voice-title">{t.voice}</h2>
      <p>{t.voiceHelp}</p>
    </div>
    <div className="mic-stage">
      <div className="wave wave-left" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="mic-ring">
        <button type="button" className="mic-button" onClick={onMic} disabled={!ready || processing}
          aria-label={listening ? t.stop : t.tap}>
          {listening ? <Square size={30} fill="currentColor" /> : <Mic size={40} strokeWidth={1.85} />}
        </button>
      </div>
      <div className="wave wave-right" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
    </div>
    <p className="mic-caption">{listening ? t.stop : processing ? t.processing : t.tap}</p>
    <div className={`voice-feedback ${feedback.status === 'error' ? 'error' : ''}`} role="status" aria-atomic="true">
      {message && <p>{message}</p>}
      {feedback.transcript && <p className="transcript"><span>{t.heard}</span> {feedback.transcript}</p>}
    </div>
    <div className="voice-alternatives">
      <button className="button voice-secondary" type="button" aria-expanded={typed} aria-controls="typed-command"
        onClick={() => {
          if (typed) setTyped(false)
          else {
            setTyped(true)
            requestAnimationFrame(() => input.current?.focus())
          }
        }}><Keyboard size={18} aria-hidden="true" />{t.type}</button>
      <details className="examples">
        <summary>{t.examples}<ChevronDown size={16} aria-hidden="true" /></summary>
        <ul>{examples.map(example => <li key={example}>{example}</li>)}</ul>
      </details>
    </div>
    <form id="typed-command" className="typed-form" hidden={!typed} onSubmit={event => {
      event.preventDefault()
      const value = command.trim()
      if (value) onCommand(value)
    }}>
      <input ref={input} value={command} onChange={event => setCommand(event.target.value)}
        aria-label={t.type} placeholder={examples[0]} maxLength={300} required />
      <button className="button primary" disabled={!ready || busy} type="submit" aria-label={t.send}><ArrowRight size={20} /></button>
    </form>
  </section>
}
