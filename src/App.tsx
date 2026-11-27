import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, FileText, LayoutList, MessageSquareText } from 'lucide-react'
import { AppHeader, EmployerCard, LocalFooter, ManualActions, TransactionList, WageBalance } from './components/LedgerPanels'
import { EntryDialog } from './components/EntryDialog'
import { BackupPanel } from './components/BackupPanel'
import { VoiceGuide } from './components/VoiceGuide'
import { VoicePanel } from './components/VoicePanel'
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
import { wageTools } from './locales/wageTools'
import { speechToText } from './services/speech'
import { spokenMoney, textToSpeech } from './services/readAloud'
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
  try { return localStorage.getItem('bolhaq-guide-complete') !== '1' } catch { return true }
}

type ToolView = ReportView | { view: 'backup' }
type SiteRequest = { scope: 'select' | 'balance'; siteId?: string; message?: keyof Messages; transcript?: string }
const clarification: Record<InterpretationIssue, keyof Messages> = {
  amount: 'clarifyAmount', details: 'clarify', worksite: 'clarifyWorksite',
  worksiteAmbiguous: 'clarifyDuplicateWorksite', paymentState: 'clarifyPaymentState', oneAction: 'clarifyOneAction',
}

export default function App() {
  const [locale, setLocale] = useState(preferredLocale)
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [loadingFailed, setLoadingFailed] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [tool, setTool] = useState<ToolView>()
  const [siteRequest, setSiteRequest] = useState<SiteRequest>()
  const [commandEdit, setCommandEdit] = useState({ text: '', version: 0 })
  const [guide, setGuide] = useState(false)
  const [feedback, setFeedback] = useState<VoiceFeedback>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string>()
  const [playback, setPlayback] = useState<keyof Messages>()
  const lock = useRef(false)
  const playbackVersion = useRef(0)
  const recognition = useRef<ReturnType<typeof speechToText.listen> | null>(null)
  const capturing = useRef(false)
  const language = languages.find(option => option.code === locale) ?? languages[0]
  const t = language.messages
  const w = wageTools(locale)

  useEffect(() => {
    let mounted = true
    textToSpeech.prime()
    void ledgerStore.read().then(data => {
      if (mounted) { setLedger(data); setGuide(shouldShowGuide(data)) }
    }, () => { if (mounted) setLoadingFailed(true) })
    return () => {
      mounted = false
      recognition.current?.cancel()
      textToSpeech.cancel()
    }
  }, [])
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    const sync = () => {
      document.documentElement.toggleAttribute('data-inactive', document.hidden)
      // A permission prompt can interrupt page visibility while the microphone is opening.
      if (document.hidden && capturing.current && recognition.current) {
        recognition.current.cancel()
        recognition.current = null
        capturing.current = false
        setFeedback({ status: 'error', message: 'speechInterrupted' })
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      document.documentElement.removeAttribute('data-inactive')
    }
  }, [])

  function cancelSpeech() {
    recognition.current?.cancel()
    recognition.current = null
    capturing.current = false
    playbackVersion.current++
    textToSpeech.cancel()
    setPlayback(undefined)
  }

  function changeLanguage(next: Locale) {
    cancelSpeech()
    setLocale(next)
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

  function dismissGuide() {
    setGuide(false)
    try { localStorage.setItem('bolhaq-guide-complete', '1') } catch { /* Dismissed for this session. */ }
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
    if (explicit) {
      setFeedback({ status: 'idle' })
      setPlayback('reading')
    } else {
      setFeedback({ status: 'success', transcript, reply })
    }
    void textToSpeech.speak(narration, locale).then(result => {
      if (version !== playbackVersion.current || result === 'cancelled') return
      const message = result === 'unavailable' ? 'voiceUnavailable' : result === 'failed' ? 'playbackError' : undefined
      if (explicit) setPlayback(message)
      else if (message) setFeedback({ status: 'success', transcript, reply, message })
    })
  }

  function handleCommand(command: string, source: 'typed' | 'speech') {
    if (!ledger || lock.current) return
    const parsed = interpretIntent(command, { worksites: ledger.employers, activeWorksiteId: ledger.activeId })
    const transcript = source === 'speech' ? parsed.original : undefined
    const message = parsed.issue && clarification[parsed.issue]
    const reference = 'reference' in parsed ? parsed.reference : undefined
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

  function toggleMicrophone() {
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
        setFeedback({ status: 'error', message })
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
        available={speechToText.available()} onMic={toggleMicrophone}
        onCancel={() => { cancelSpeech(); setFeedback({ status: 'idle' }) }}
        onCommand={command => handleCommand(command, 'typed')} />
      {guide && ledger && <VoiceGuide w={w} examples={language.examples} finished={ledger.work.length > 0} onDismiss={dismissGuide} />}
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
            disabled={saving} onClick={() => openTool(view === 'backup' ? { view } : { view, siteId: ledger.activeId ?? undefined })}>
            <Icon size={18} aria-hidden="true" />{w[view]}
          </button>)}
        </div>
      </section>}
      <LocalFooter t={t} />
    </main>
    <EntryDialog editor={editor} t={t} locale={locale} employerName={employerName} employers={ledger?.employers ?? []}
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
