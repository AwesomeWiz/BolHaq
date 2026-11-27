import { useCallback, useEffect, useRef, useState } from 'react'
import { DatabaseBackup, FileText, LayoutList, MessageSquareText } from 'lucide-react'
import { AppHeader, EmployerCard, LocalFooter, ManualActions, TransactionList, WageBalance } from './components/LedgerPanels'
import { EntryDialog } from './components/EntryDialog'
import { BackupPanel } from './components/BackupPanel'
import { GuidedTour, VoiceGuide } from './components/VoiceGuide'
import { SpeechDiagnostics } from './components/SpeechDiagnostics'
import { speechDebugEnabled } from './services/speechDiagnostics'
import { VoicePanel } from './components/VoicePanel'
import { CloudRecordingPanel } from './components/CloudRecordingPanel'
import type { CloudRecordingFeedback } from './components/CloudRecordingPanel'
import { ToolDialog } from './components/ToolDialog'
import { WageReports } from './components/WageReports'
import { WorksiteChoice } from './components/WorksiteChoice'
import type { ReportView } from './components/WageReports'
import type { VoiceFeedback } from './components/VoicePanel'
import { LedgerError, totals, validateProposal } from './domain/ledger'
import type { Ledger } from './domain/ledger'
import { interpretIntent } from './domain/interpretIntent'
import type { InterpretationIssue } from './domain/interpretIntent'
import { draftFromIntent, newDraft, reviewDraft, withInlineEdits } from './features/proposals'
import type { Draft, Editor } from './features/proposals'
import { languages, money } from './locales'
import type { Locale } from './locales'
import type { Messages } from './locales/en'
import { onboarding, tourSteps } from './locales/onboarding'
import { tourNarration } from './services/tourNarration'
import type { PlaybackResult } from './services/readAloud'
import { wageTools } from './locales/wageTools'
import { speechToText } from './services/speech'
import {
  speakBalanceHybrid, spokenMoney, textToSpeech,
  cancelCloudTts,
} from './services/readAloud'
import {
  cloudSpeechAvailable, startCloudRecording, supportedMimeType, transcribeBlob,
} from './services/cloudSpeech'
import type { CloudSpeechLocale } from './services/cloudSpeech'
import { ledgerStore } from './services/storage'

function preferredLocale(): Locale {
  try {
    return languages.find(language => language.code === localStorage.getItem('bolhaq-language'))?.code ?? 'en-IN'
  } catch {
    return 'en-IN'
  }
}

function shouldShowGuide(ledger: Ledger) {
  if (ledger.employers.length) return false
  try {
    const outcome = localStorage.getItem('bolhaq-guide-complete')
    return outcome !== '1' && outcome !== 'completed' && outcome !== 'skipped'
  } catch { return true }
}

/** Returns true when iOS + Hindi/Malayalam — locales where cloud STT is preferred. */
function shouldOfferCloudSpeech(locale: Locale): locale is CloudSpeechLocale {
  if (locale !== 'hi-IN' && locale !== 'ml-IN') return false
  if (!cloudSpeechAvailable()) return false
  // Heuristic: iOS Safari lacks a reliable Malayalam service, Hindi often times out.
  // We always offer cloud on iOS for these locales. On Android/desktop the browser
  // path usually works; we still offer cloud after specific failures.
  return true
}

type ToolView = ReportView | { view: 'backup' }
type SiteRequest = { scope: 'select' | 'balance'; siteId?: string; message?: keyof Messages; transcript?: string }
const clarification: Record<InterpretationIssue, keyof Messages> = {
  amount: 'clarifyAmount', details: 'clarify', worksite: 'clarifyWorksite',
  worksiteAmbiguous: 'clarifyDuplicateWorksite', paymentState: 'clarifyPaymentState', oneAction: 'clarifyOneAction',
}

type CloudSttState =
  | { active: false }
  | { active: true; phase: 'consent' | 'recording' | 'review' | 'uploading' | 'error'; blob?: Blob; durationMs?: number; elapsedMs?: number; errorKey?: keyof Messages }

export default function App() {
  const [locale, setLocale] = useState(preferredLocale)
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [loadingFailed, setLoadingFailed] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [tool, setTool] = useState<ToolView>()
  const [siteRequest, setSiteRequest] = useState<SiteRequest>()
  const [commandEdit, setCommandEdit] = useState({ text: '', version: 0 })
  const [guide, setGuide] = useState(false)
  const [tourIndex, setTourIndex] = useState<number | null>(null)
  const [tourPlayback, setTourPlayback] = useState<PlaybackResult>()
  const tourTrigger = useRef<HTMLButtonElement>(null)
  const tourPlaybackVersion = useRef(0)
  const [malayalamSpeechBlocked, setMalayalamSpeechBlocked] = useState(false)
  const [feedback, setFeedback] = useState<VoiceFeedback>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string>()
  const [playback, setPlayback] = useState<keyof Messages>()
  const [cloudStt, setCloudStt] = useState<CloudSttState>({ active: false })
  const lock = useRef(false)
  const playbackVersion = useRef(0)
  const recognition = useRef<ReturnType<typeof speechToText.listen> | null>(null)
  const capturing = useRef(false)
  const cloudRecordingRef = useRef<{ stop(): void; cancel(): void } | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const language = languages.find(option => option.code === locale) ?? languages[0]
  const t = language.messages
  const w = wageTools(locale)
  const micBlocked = locale === 'ml-IN' && malayalamSpeechBlocked

  const stopTourAudio = useCallback((clearStatus = true) => {
    tourPlaybackVersion.current++
    tourNarration.cancel()
    if (clearStatus) setTourPlayback(undefined)
  }, [])

  useEffect(() => {
    let mounted = true
    textToSpeech.prime()
    void ledgerStore.read().then(data => {
      if (mounted) { setLedger(data); setGuide(shouldShowGuide(data)) }
    }, () => { if (mounted) setLoadingFailed(true) })
    return () => {
      mounted = false
      recognition.current?.cancel()
      speechToText.cancel()
      stopTourAudio(false)
      textToSpeech.cancel()
      cancelCloudTts()
      cloudRecordingRef.current?.cancel()
      uploadAbortRef.current?.abort()
    }
  }, [stopTourAudio])
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    const sync = () => {
      document.documentElement.toggleAttribute('data-inactive', document.hidden)
      if (document.hidden) stopTourAudio()
      if (document.hidden && capturing.current && recognition.current) {
        recognition.current.cancel()
        recognition.current = null
        capturing.current = false
        setFeedback({ status: 'error', message: 'speechInterrupted' })
      }
      // Cancel cloud recording if page hides.
      if (document.hidden && cloudStt.active) {
        cancelCloudSession()
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      document.documentElement.removeAttribute('data-inactive')
    }
  }, [stopTourAudio, cloudStt.active])

  function cancelCloudSession() {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    cloudRecordingRef.current?.cancel()
    cloudRecordingRef.current = null
    setCloudStt({ active: false })
  }

  function cancelSpeech() {
    stopTourAudio()
    recognition.current?.cancel()
    recognition.current = null
    capturing.current = false
    playbackVersion.current++
    textToSpeech.cancel()
    cancelCloudTts()
    setPlayback(undefined)
    cancelCloudSession()
  }

  function changeLanguage(next: Locale) {
    if (next === locale) return
    cancelSpeech()
    speechToText.cancel()
    setLocale(next)
    if (tourIndex !== null) playTour(tourIndex, next)
    setFeedback({ status: 'idle' })
    try { localStorage.setItem('bolhaq-language', next) } catch { /* Language still applies to this session. */ }
  }

  function openManual(kind: Draft['kind']) {
    if (!ledger) return
    cancelSpeech()
    setFeedback({ status: 'idle' })
    setEditor({ draft: newDraft(kind, ledger), stage: 'edit' })
  }

  function openTool(next: ToolView, transcript?: string) {
    if (!ledger || lock.current) return
    cancelSpeech()
    setFeedback({ status: 'idle', transcript })
    setTool(next)
  }

  function playTour(index: number, languageCode: Locale) {
    stopTourAudio()
    if (recognition.current || document.hidden) return
    playbackVersion.current++
    textToSpeech.cancel()
    setPlayback(undefined)
    const version = tourPlaybackVersion.current
    const step = tourSteps[index]
    void tourNarration.play(step, languageCode, onboarding(languageCode).steps[step][1]).then(result => {
      if (version === tourPlaybackVersion.current) setTourPlayback(result)
    })
  }

  function startTour(trigger: HTMLButtonElement) {
    cancelSpeech()
    tourTrigger.current = trigger
    setFeedback({ status: 'idle' })
    setGuide(false)
    moveTour(0)
  }

  function moveTour(index: number) {
    setTourIndex(index)
    playTour(index, locale)
  }

  function dismissGuide(outcome: 'completed' | 'skipped') {
    stopTourAudio()
    setGuide(false)
    setTourIndex(null)
    try { localStorage.setItem('bolhaq-guide-complete', outcome) } catch { /* Dismissed for this session. */ }
    if (tourIndex !== null) requestAnimationFrame(() => {
      const trigger = tourTrigger.current
      if (trigger?.isConnected) trigger.focus()
      else document.getElementById('voice-help-button')?.focus()
    })
  }

  async function restoreBackup(content: string) {
    if (lock.current) throw new LedgerError('changed')
    lock.current = true
    setSaving(true)
    try {
      setLedger(await ledgerStore.restore(content))
      setLastSavedId(undefined)
      setGuide(false)
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  async function selectEmployer(id: string) {
    if (lock.current) return
    cancelSpeech()
    lock.current = true
    setSaving(true)
    setFeedback({ status: 'idle' })
    try {
      setLedger(await ledgerStore.select(id))
      setLastSavedId(undefined)
    } catch {
      setFeedback({ status: 'error', message: 'storage' })
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  function speakBalance(transcript?: string, explicit = false, worksiteId?: string) {
    const site = ledger?.employers.find(employer => employer.id === (worksiteId ?? ledger.activeId))
    if (!ledger || !site) {
      setFeedback({ status: 'error', message: 'chooseEmployer', transcript })
      return
    }
    const { balance } = totals(ledger, site.id)
    const template = balance === 0 ? t.settledReply : balance < 0 ? t.advanceReply : t.balanceReply
    const label = worksiteId ? `${site.name} · ` : ''
    const reply = label + template.replace('{amount}', money(Math.abs(balance), locale))
    const narration = label + template.replace('{amount}', spokenMoney(Math.abs(balance), locale))
    const version = ++playbackVersion.current
    const balanceType = balance === 0 ? 'settled' : balance < 0 ? 'advance' : 'outstanding'
    const paise = Math.abs(balance)
    if (explicit) {
      setFeedback({ status: 'idle' })
      setPlayback('reading')
    } else {
      setFeedback({ status: 'success', transcript, reply })
    }

    // Use hybrid TTS (browser → Bulbul fallback for hi-IN/ml-IN).
    if (locale === 'hi-IN' || locale === 'ml-IN') {
      void speakBalanceHybrid({ paise, balanceType }, locale, narration).then(result => {
        if (version !== playbackVersion.current || result === 'cancelled') return
        let message: keyof Messages | undefined
        if (result === 'unavailable') message = 'voiceUnavailable'
        else if (result === 'failed') message = 'playbackError'
        else if (result === 'cloud-quota') message = 'cloudTtsQuota'
        else if (result === 'cloud-failed' || result === 'cloud-disabled') message = 'cloudTtsError'
        if (explicit) setPlayback(message)
        else if (message) setFeedback({ status: 'success', transcript, reply, message })
      })
    } else {
      void textToSpeech.speak(narration, locale).then(result => {
        if (version !== playbackVersion.current || result === 'cancelled') return
        const message = result === 'unavailable' ? 'voiceUnavailable' : result === 'failed' ? 'playbackError' : undefined
        if (explicit) setPlayback(message)
        else if (message) setFeedback({ status: 'success', transcript, reply, message })
      })
    }
  }

  function handleCommand(command: string, source: 'typed' | 'speech') {
    if (!ledger || lock.current) return
    stopTourAudio()
    const parsed = interpretIntent(command, { worksites: ledger.employers, activeWorksiteId: ledger.activeId })
    const transcript = source === 'speech' ? parsed.original : undefined
    const message = parsed.issue && clarification[parsed.issue]
    const reference = 'reference' in parsed ? parsed.reference : undefined
    if (parsed.intent === 'PAYMENT_NOT_RECEIVED') {
      setFeedback({ status: 'idle', message: 'paymentNotReceived', transcript })
      return
    }
    if (parsed.intent === 'UNKNOWN') {
      setFeedback({ status: 'error', message: message ?? 'unknown', transcript, editableCommand: parsed.original })
      return
    }
    if (parsed.intent === 'SELECT_WORKSITE' || parsed.intent === 'QUERY_WORKSITE_BALANCE') {
      const selecting = parsed.intent === 'SELECT_WORKSITE'
      if (!selecting && parsed.worksiteId) speakBalance(transcript, false, reference ? parsed.worksiteId : undefined)
      else if (ledger.employers.length) {
        cancelSpeech()
        setFeedback({ status: 'idle', transcript })
        setSiteRequest({ scope: selecting ? 'select' : 'balance', siteId: parsed.worksiteId, message, transcript })
      } else setFeedback({ status: 'error', message: 'chooseEmployer', transcript, editableCommand: parsed.original })
      return
    }
    if (parsed.intent === 'QUERY_TOTAL_BALANCE' || parsed.intent === 'GENERATE_WAGE_REPORT' ||
        parsed.intent === 'PREPARE_PAYMENT_REMINDER') {
      const view = parsed.intent === 'QUERY_TOTAL_BALANCE' ? 'overview' :
        parsed.intent === 'GENERATE_WAGE_REPORT' ? 'statement' : 'reminder'
      const { month } = parsed.parameters
      openTool({ view, siteId: parsed.worksiteId, period: month ? { kind: 'month', month } : undefined }, transcript)
      return
    }
    const draft = draftFromIntent(parsed, ledger)
    if (!draft) return
    if (draft.kind !== 'employer' && !ledger.employers.length) {
      setFeedback({ status: 'error', message: 'chooseEmployer', transcript, editableCommand: parsed.original })
      return
    }
    const next: Editor = parsed.status === 'missing' || parsed.status === 'ambiguous'
      ? { draft, stage: 'edit', error: message ?? 'clarify', missing: parsed.missing, chooseWorksite: parsed.missing.includes('worksite') }
      : reviewDraft(draft, ledger)
    setEditor(next)
    setFeedback({ status: 'awaiting', transcript, editableCommand: parsed.original })
  }

  function editCommand(text: string) {
    setEditor(null)
    setFeedback({ status: 'idle' })
    setCommandEdit(previous => ({ text, version: previous.version + 1 }))
  }

  // ---- Cloud STT flow ----

  function openCloudRecording() {
    // Show consent screen before any microphone access.
    cancelSpeech()
    setFeedback({ status: 'idle' })
    setCloudStt({ active: true, phase: 'consent' })
  }

  function startCloudCapture() {
    const mimeType = supportedMimeType()
    if (!mimeType) {
      setCloudStt({ active: true, phase: 'error', errorKey: 'cloudFormatError' })
      return
    }
    setCloudStt({ active: true, phase: 'recording', elapsedMs: 0 })

    cloudRecordingRef.current = startCloudRecording(mimeType, {
      started() {
        setCloudStt(prev => prev.active ? { ...prev, phase: 'recording', elapsedMs: 0 } : prev)
      },
      tick(elapsedMs) {
        setCloudStt(prev => prev.active ? { ...prev, elapsedMs } : prev)
      },
      stopped(blob, durationMs) {
        cloudRecordingRef.current = null
        setCloudStt({ active: true, phase: 'review', blob, durationMs })
      },
      failed(reason) {
        cloudRecordingRef.current = null
        const errorKey: keyof Messages = reason === 'permission' ? 'cloudPermissionError'
          : reason === 'format' ? 'cloudFormatError' : 'cloudServerError'
        setCloudStt({ active: true, phase: 'error', errorKey })
      },
    })
  }

  async function sendCloudRecording() {
    if (cloudStt.active && cloudStt.phase === 'review' && cloudStt.blob) {
      const blob = cloudStt.blob
      setCloudStt({ active: true, phase: 'uploading' })
      const controller = new AbortController()
      uploadAbortRef.current = controller

      const cloudLocale = locale as CloudSpeechLocale
      const result = await transcribeBlob(blob, cloudLocale, controller.signal)
      uploadAbortRef.current = null

      if (controller.signal.aborted) return  // cancelled
      setCloudStt({ active: false })

      if (result.status === 'transcript') {
        handleCommand(result.text, 'speech')
      } else {
        const errorKeyMap: Record<string, keyof Messages> = {
          quota: 'cloudQuota', disabled: 'cloudDisabled', timeout: 'cloudTimeout',
          format: 'cloudFormatError', size: 'cloudFormatError', server: 'cloudServerError',
          network: 'cloudNetworkError',
        }
        setFeedback({ status: 'error', message: errorKeyMap[result.code] ?? 'cloudServerError' })
      }
    }
  }

  function toggleMicrophone() {
    if (micBlocked) return

    // If cloud recording panel is showing, treat mic tap as cancel.
    if (cloudStt.active) { cancelCloudSession(); return }

    if (recognition.current) {
      recognition.current.stop()
      return
    }
    cancelSpeech()
    setFeedback({ status: 'starting' })
    recognition.current = speechToText.listen(locale, {
      started: () => {
        capturing.current = true
        setFeedback({ status: 'listening', startedAt: Date.now() })
      },
      sound: active => setFeedback(previous => previous.status === 'listening' ? { ...previous, sound: active } : previous),
      processing: () => setFeedback({ status: 'processing' }),
      recognized: transcript => {
        recognition.current = null
        capturing.current = false
        handleCommand(transcript, 'speech')
      },
      failed: message => {
        recognition.current = null
        capturing.current = false
        if (message === 'speechServiceBlocked') setMalayalamSpeechBlocked(true)
        setFeedback({ status: 'error', message })

        // After certain failures on hi-IN/ml-IN, automatically offer cloud path.
        const cloudFail = message === 'speechServiceBlocked' || message === 'speechNoResult' ||
          message === 'speechLanguage' || message === 'timeout'
        if (cloudFail && shouldOfferCloudSpeech(locale)) {
          // Slight delay so the error message renders before panel opens.
          setTimeout(() => openCloudRecording(), 600)
        }
      },
    })
  }

  async function confirm() {
    if (!ledger || !editor?.proposal || editor.stage !== 'review' || lock.current) return
    const proposal = withInlineEdits(editor.proposal, editor.draft)
    try {
      validateProposal(ledger, proposal)
    } catch (error) {
      if (!(error instanceof LedgerError)) throw error
      setEditor({ ...editor, error: error.issue })
      return
    }
    lock.current = true
    setSaving(true)
    try {
      setLedger(await ledgerStore.confirm(proposal, proposal.id))
      setLastSavedId(proposal.id)
      setEditor(null)
      setFeedback(previous => ({ status: 'success', message: 'success', transcript: previous.transcript }))
    } catch (error) {
      if (error instanceof LedgerError) {
        try {
          const latest = await ledgerStore.read()
          setLedger(latest)
          const next = reviewDraft(editor.draft, latest)
          setEditor(next.stage === 'conflict' ? next : { draft: editor.draft, stage: 'edit', error: error.issue })
        } catch {
          setEditor({ ...editor, error: 'storage' })
        }
      } else {
        setEditor({ ...editor, error: 'storage' })
      }
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  function closeEditor() {
    setEditor(null)
    setFeedback({ status: 'idle' })
  }

  const employerName = ledger?.employers.find(employer => employer.id === editor?.draft.employerId)?.name ?? ''

  // Cloud recording feedback adapter for CloudRecordingPanel.
  const cloudFeedback: CloudRecordingFeedback = cloudStt.active
    ? { phase: cloudStt.phase, elapsedMs: cloudStt.elapsedMs, durationMs: cloudStt.durationMs, errorKey: cloudStt.errorKey }
    : { phase: 'consent' }

  return <>
    <AppHeader locale={locale} t={t} onLanguage={changeLanguage} />
    <main className="shell main-content">
      <h1>{t.ledger}</h1>
      {!ledger && <div className={`notice ${loadingFailed ? 'error' : ''}`} role="status">
        {loadingFailed ? t.storage : t.loading}
        {loadingFailed && <button className="button" type="button" onClick={() => {
          setLoadingFailed(false)
          void ledgerStore.read().then(data => { setLedger(data); setGuide(shouldShowGuide(data)) }, () => setLoadingFailed(true))
        }}>{t.retry}</button>}
      </div>}
      <VoicePanel key={commandEdit.version} initialCommand={commandEdit.text} onEditCommand={editCommand}
        t={t} examples={language.examples} feedback={feedback} ready={Boolean(ledger) && !saving}
        available={speechToText.available()} micBlocked={micBlocked} onMic={toggleMicrophone}
        onCancel={() => { cancelSpeech(); setFeedback({ status: 'idle' }) }}
        onCommand={command => handleCommand(command, 'typed')}
        tourLabel={ledger && tourIndex === null ? onboarding(locale).restart : undefined} onTour={startTour}
        onCloudRecord={shouldOfferCloudSpeech(locale) ? openCloudRecording : undefined}
        cloudRecordingAvailable={cloudSpeechAvailable() && shouldOfferCloudSpeech(locale)} />
      {cloudStt.active && (
        <CloudRecordingPanel
          t={t}
          locale={locale}
          feedback={cloudFeedback}
          onConsent={startCloudCapture}
          onStart={() => {}}
          onStop={() => cloudRecordingRef.current?.stop()}
          onSend={() => void sendCloudRecording()}
          onDiscard={cancelCloudSession}
          onCancel={cancelCloudSession}
        />
      )}
      {import.meta.env.DEV && speechDebugEnabled() && <SpeechDiagnostics locale={locale} />}
      {guide && ledger && <VoiceGuide w={w} locale={locale} onStart={startTour} onDismiss={() => dismissGuide('skipped')} />}
      {ledger && <div className="workspace">
        <div className="wage-summary">
          <EmployerCard t={t} locale={locale} ledger={ledger} ready={!saving} onSelect={id => void selectEmployer(id)}
            onAdd={() => openManual('employer')} />
          <WageBalance t={t} locale={locale} ledger={ledger} employerId={ledger.activeId} playback={playback}
            onSpeak={() => { if (!lock.current) { cancelSpeech(); speakBalance(undefined, true) } }} />
        </div>
        <div className="activity-column">
          <ManualActions t={t} ready={Boolean(ledger.activeId) && !saving} onAction={openManual} />
          <TransactionList t={t} locale={locale} ledger={ledger} lastSavedId={lastSavedId} />
        </div>
      </div>}
      {ledger && <section className="wage-tools" aria-labelledby="wage-tools">
        <h2 id="wage-tools">{w.tools}</h2>
        <div className="tool-links">
          {([
            { view: 'statement', Icon: FileText }, { view: 'reminder', Icon: MessageSquareText },
            { view: 'overview', Icon: LayoutList }, { view: 'backup', Icon: DatabaseBackup },
          ] as const).map(({ view, Icon }) => <button key={view} type="button" className="button"
            data-tour-target={view === 'overview' ? 'reports' : undefined}
            disabled={saving} onClick={() => openTool(view === 'backup' ? { view } : { view, siteId: ledger.activeId ?? undefined })}>
            <Icon size={18} aria-hidden="true" /><span>{w[view]}</span>
          </button>)}
        </div>
      </section>}
      <LocalFooter t={t} />
    </main>
    {tourIndex !== null && !editor && !tool && !siteRequest &&
      <GuidedTour index={tourIndex} locale={locale} example={language.examples[0]} t={t} playback={tourPlayback}
        busy={feedback.status === 'starting' || feedback.status === 'listening' || feedback.status === 'processing'}
        onReplay={() => playTour(tourIndex, locale)} onMove={moveTour} onExit={dismissGuide} />}
    <EntryDialog editor={editor}
      tourNote={tourIndex !== null && ['mic', 'review'].includes(tourSteps[tourIndex]) ? onboarding(locale).reviewNote : undefined} t={t} locale={locale} employerName={employerName} employers={ledger?.employers ?? []}
      transcript={feedback.transcript} saving={saving}
      onRetry={feedback.editableCommand ? () => editCommand(feedback.editableCommand!) : undefined}
      onChange={patch => setEditor(previous => previous && { ...previous, draft: { ...previous.draft, ...patch }, error: undefined })}
      onReview={replace => {
        if (!editor || !ledger) return
        const correction = editor.existing?.date === editor.draft.date ? editor.existing : undefined
        setEditor(reviewDraft(editor.draft, ledger, replace || editor.stage === 'edit' ? correction : undefined))
      }}
      onEdit={() => setEditor(previous => previous && {
        draft: previous.draft, stage: 'edit', existing: previous.stage === 'review' ? previous.existing : undefined,
      })}
      onClose={closeEditor} onConfirm={() => void confirm()} />
    {siteRequest && ledger && <ToolDialog title={siteRequest.scope === 'select' ? t.switchWorksite : t.worksite}
      closeLabel={t.closeDialog} onClose={() => setSiteRequest(undefined)}>
      <WorksiteChoice scope={siteRequest.scope} siteId={siteRequest.siteId}
        message={siteRequest.message && t[siteRequest.message]} employers={ledger.employers} locale={locale} t={t}
        onCancel={() => setSiteRequest(undefined)} onChoose={id => {
          setSiteRequest(undefined)
          if (siteRequest.scope === 'select') void selectEmployer(id)
          else speakBalance(siteRequest.transcript, false, id)
        }} />
    </ToolDialog>}
    {tool && ledger && <ToolDialog title={w[tool.view]} closeLabel={t.closeDialog} busy={saving} onClose={() => setTool(undefined)}>
      {tool.view === 'backup' ? <BackupPanel locale={locale} t={t} w={w} saving={saving}
        onRead={ledgerStore.read} onRestore={restoreBackup} /> :
        <WageReports key={`${tool.view}:${tool.siteId ?? ''}`} view={tool} ledger={ledger} locale={locale}
          onStatement={(siteId, period) => setTool({ view: 'statement', siteId, period })} />}
    </ToolDialog>}
  </>
}
