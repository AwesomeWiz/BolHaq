import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CircleAlert, CircleHelp, Keyboard, LoaderCircle, Mic, Square } from 'lucide-react'
import type { Messages } from '../locales/en'

export type VoiceStatus = 'idle' | 'starting' | 'listening' | 'processing' | 'awaiting' | 'success' | 'error'
export type VoiceFeedback = {
  status: VoiceStatus
  message?: keyof Messages
  reply?: string
  transcript?: string
  editableCommand?: string
  startedAt?: number
  sound?: boolean
}

const retryableSpeech = new Set<keyof Messages>([
  'denied', 'timeout', 'emptySpeech', 'speechUnavailable', 'speechCapture', 'speechInterrupted', 'speechError',
])

const pattern = [10, 16, 25, 14, 34, 51, 29, 63, 44, 78, 55, 85, 64, 43, 71, 39]

function Waveform({ reverse = false }: { reverse?: boolean }) {
  const bars = reverse ? [...pattern].reverse() : pattern
  return <div className="waveform" aria-hidden="true">
    {bars.map((height, index) => <i key={index} style={{ height: height + '%', animationDelay: -height * 11 + 'ms' }} />)}
  </div>
}

function RecordingClock({ startedAt }: { startedAt: number }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    function sync() {
      clearInterval(timer)
      if (document.hidden) return
      const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
      tick()
      timer = setInterval(tick, 250)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync) }
  }, [startedAt])
  const time = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':')
  return <time className="recording-clock" dateTime={`PT${seconds}S`}>{time}</time>
}

export function VoicePanel({ t, examples, feedback, ready, available, initialCommand = '', onMic, onCancel, onCommand, onEditCommand, tourLabel, onTour }: {
  t: Messages; examples: readonly string[]; feedback: VoiceFeedback; ready: boolean; available: boolean
  initialCommand?: string
  onMic(): void; onCancel(): void; onCommand(command: string): void
  onEditCommand(command: string): void
  tourLabel?: string; onTour(trigger: HTMLButtonElement): void
}) {
  const [typed, setTyped] = useState(Boolean(initialCommand))
  const [help, setHelp] = useState(false)
  const [command, setCommand] = useState(initialCommand)
  const input = useRef<HTMLInputElement>(null)
  const { status, transcript, startedAt, sound, reply } = feedback
  const listening = status === 'listening'
  const busy = listening || status === 'starting' || status === 'processing'
  const buttonLabel = listening ? t.stop : status === 'starting' ? t.starting :
    status === 'processing' ? t.processing : t.tap
  const message = feedback.message ? t[feedback.message] :
    status === 'idle' ? (available ? '' : t.unsupported) : status === 'error' ? t.unknown :
      (reply || status === 'success' || status === 'awaiting' ? t[status] : '')
  const Icon = listening ? Square : busy ? LoaderCircle : Mic

  useEffect(() => {
    if (!typed || busy) return
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [typed, busy])

  return <section className="voice-panel" aria-labelledby="voice-title" data-state={status} data-sound={sound || undefined}>
    <div className="voice-copy">
      <h2 id="voice-title">{t.voice}</h2>
      <p>{t.voiceHelp}</p>
    </div>
    <div className="mic-stage">
      <Waveform />
      <div className="mic-ring">
        <button type="button" className="mic-button" data-tour-target="mic" onClick={() => { if (!busy || listening) onMic() }} disabled={!ready}
          aria-disabled={status === 'processing' || status === 'starting' || undefined}
          aria-label={buttonLabel}>
          <Icon size={listening ? 27 : 39} strokeWidth={1.8} fill={listening ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <Waveform reverse />
    </div>
    <div className="recording-meta">
      <p className="mic-caption" role="status">
        {listening && <i className="live-dot" aria-hidden="true" />}
        {listening ? t.listening : buttonLabel}
      </p>
      {listening && startedAt !== undefined && <RecordingClock startedAt={startedAt} />}
    </div>
    <div className={`voice-feedback ${status === 'error' ? 'error' : ''}`} role="status" aria-atomic="true">
      {reply && <p className="voice-reply">{reply}</p>}
      {message && (!reply || feedback.message) && <p>
        {status === 'error' && <CircleAlert size={16} aria-hidden="true" />}
        {status === 'success' && !reply && <Check size={16} aria-hidden="true" />}{message}
      </p>}
      {transcript && <p className="transcript"><span>{t.heard}</span>{transcript}</p>}
    </div>
    {busy ? <button type="button" className="button voice-secondary" onClick={onCancel}>{t.cancel}</button> :
      <div className="voice-alternatives">
        {status === 'error' && feedback.message && retryableSpeech.has(feedback.message) && available &&
          <button type="button" className="button voice-secondary" disabled={!ready} onClick={onMic}>{t.retry}</button>}
        {status === 'error' && feedback.editableCommand && <button type="button" className="button voice-secondary"
          onClick={() => onEditCommand(feedback.editableCommand!)}>{t.editCommand}</button>}
        <button className="button voice-secondary" type="button" aria-expanded={typed} aria-controls="typed-command"
          onClick={() => { setTyped(!typed); setHelp(false) }}><Keyboard size={18} aria-hidden="true" />{t.type}</button>
        <button id="voice-help-button" className="button voice-secondary" type="button" aria-expanded={help} aria-controls="voice-examples"
          onClick={() => { setHelp(!help); setTyped(false) }}><CircleHelp size={18} aria-hidden="true" />{t.examples}</button>
      </div>}
    <div id="voice-examples" className="examples" hidden={!help || busy}>
      <ul>{examples.map(example => <li key={example}>{example}</li>)}</ul>
      {tourLabel && <button type="button" className="button voice-secondary restart-tour"
        onClick={event => onTour(event.currentTarget)}>{tourLabel}</button>}
    </div>
    <form id="typed-command" className="typed-form" hidden={!typed || busy} onSubmit={event => {
      event.preventDefault()
      const value = command.trim()
      if (value) onCommand(value)
    }}>
      <input ref={input} value={command} onChange={event => setCommand(event.target.value)}
        aria-label={t.type} placeholder={examples[0]} maxLength={300} required />
      <button className="button primary" disabled={!ready || busy} type="submit" aria-label={t.send}><ArrowRight size={20} aria-hidden="true" /></button>
    </form>
  </section>
}
