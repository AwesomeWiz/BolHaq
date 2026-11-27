import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Square, X } from 'lucide-react'
import type { Messages } from '../locales/en'

export type CloudRecordingPhase =
  | 'consent'       // showing pre-recording consent
  | 'recording'     // MediaRecorder active
  | 'review'        // recording done, waiting for send/discard
  | 'uploading'     // sending to backend
  | 'error'

export interface CloudRecordingFeedback {
  phase: CloudRecordingPhase
  elapsedMs?: number
  durationMs?: number
  errorKey?: keyof Messages
}

export function CloudRecordingPanel({
  t, feedback,
  onConsent, onStop, onSend, onDiscard, onCancel,
}: {
  t: Messages
  feedback: CloudRecordingFeedback
  onConsent(): void   // user accepts consent, triggers recording start
  onStop(): void      // user taps stop
  onSend(): void      // user taps send transcript
  onDiscard(): void   // user discards clip
  onCancel(): void    // user cancels the whole flow
}) {
  const { phase, elapsedMs, durationMs } = feedback
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (phase === 'recording' && elapsedMs !== undefined) {
      setSeconds(Math.floor(elapsedMs / 1000))
      intervalRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [phase, elapsedMs])

  const recordedSecs = durationMs !== undefined ? Math.round(durationMs / 1000) : 0
  const timeStr = [Math.floor(seconds / 60), seconds % 60]
    .map(v => String(v).padStart(2, '0')).join(':')

  return (
    <div className="cloud-recording-panel" role="dialog" aria-modal="true" aria-labelledby="cloud-rec-title">
      {phase === 'consent' && (
        <>
          <div className="cloud-consent">
            <Mic size={32} aria-hidden="true" className="cloud-consent-icon" />
            <p id="cloud-rec-title" className="cloud-consent-text">{t.cloudConsentText}</p>
            <p className="cloud-consent-provider">{t.cloudConsentProvider}</p>
          </div>
          <div className="cloud-actions">
            <button type="button" className="button primary" onClick={onConsent}>
              {t.cloudStartRecording}
            </button>
            <button type="button" className="button voice-secondary" onClick={onCancel}>
              {t.cancel}
            </button>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <>
          <div className="mic-stage cloud-mic-stage">
            <div className="mic-ring">
              <button type="button" className="mic-button recording" onClick={onStop} aria-label={t.stop}>
                <Square size={27} strokeWidth={1.8} fill="currentColor" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="recording-meta">
            <p className="mic-caption" role="status">
              <i className="live-dot" aria-hidden="true" />
              {t.listening}
            </p>
            <time className="recording-clock" dateTime={`PT${seconds}S`}>{timeStr}</time>
          </div>
          <button type="button" className="button voice-secondary" onClick={onCancel}>
            {t.cancel}
          </button>
        </>
      )}

      {phase === 'review' && (
        <>
          <div className="cloud-review">
            <MicOff size={28} aria-hidden="true" />
            <p id="cloud-rec-title" className="cloud-review-duration">
              {t.cloudRecordedDuration.replace('{seconds}', String(recordedSecs))}
            </p>
          </div>
          <div className="cloud-actions">
            <button type="button" className="button primary" onClick={onSend}>
              <Send size={16} aria-hidden="true" />{t.cloudSendTranscribe}
            </button>
            <button type="button" className="button voice-secondary" onClick={onDiscard}>
              <X size={16} aria-hidden="true" />{t.cloudDiscard}
            </button>
          </div>
        </>
      )}

      {phase === 'uploading' && (
        <p id="cloud-rec-title" className="mic-caption" role="status">
          {t.cloudTranscribing}
        </p>
      )}

      {phase === 'error' && (
        <div className="voice-feedback error" role="alert">
          <p>{feedback.errorKey ? t[feedback.errorKey] : t.unknown}</p>
          <button type="button" className="button voice-secondary" onClick={onCancel}>{t.cancel}</button>
        </div>
      )}
    </div>
  )
}
