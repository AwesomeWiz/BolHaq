import { useEffect, useRef, useState } from 'react'
import { AppHeader, EmployerCard, LocalFooter, ManualActions, TransactionList, WageBalance } from './components/LedgerPanels'
import { EntryDialog } from './components/EntryDialog'
import { VoicePanel } from './components/VoicePanel'
import type { VoiceFeedback } from './components/VoicePanel'
import { LedgerError, totals, validateProposal } from './domain/ledger'
import type { Ledger } from './domain/ledger'
import { intentParser } from './domain/intent'
import { draftFromIntent, newDraft, reviewDraft, withInlineEdits } from './features/proposals'
import type { Draft, Editor } from './features/proposals'
import { languages, money } from './locales'
import type { Locale } from './locales'
import type { Messages } from './locales/en'
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

export default function App() {
  const [locale, setLocale] = useState(preferredLocale)
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [loadingFailed, setLoadingFailed] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [feedback, setFeedback] = useState<VoiceFeedback>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string>()
  const [playback, setPlayback] = useState<keyof Messages>()
  const lock = useRef(false)
  const playbackVersion = useRef(0)
  const recognition = useRef<ReturnType<typeof speechToText.listen> | null>(null)
  const language = languages.find(option => option.code === locale) ?? languages[0]
  const t = language.messages

  useEffect(() => {
    let mounted = true
    textToSpeech.prime()
    void ledgerStore.read().then(data => { if (mounted) setLedger(data) }, () => { if (mounted) setLoadingFailed(true) })
    return () => {
      mounted = false
      recognition.current?.cancel()
      textToSpeech.cancel()
    }
  }, [])
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-inactive', document.hidden)
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

  function speakBalance(transcript?: string, explicit = false) {
    if (!ledger?.activeId) {
      setFeedback({ status: 'error', message: 'chooseEmployer', transcript })
      return
    }
    const { balance } = totals(ledger, ledger.activeId)
    const template = balance === 0 ? t.settledReply : balance < 0 ? t.advanceReply : t.balanceReply
    const reply = template.replace('{amount}', money(Math.abs(balance), locale))
    const narration = template.replace('{amount}', spokenMoney(Math.abs(balance), locale))
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
    const parsed = intentParser.parse(command)
    const transcript = source === 'speech' ? parsed.transcript : undefined
    if (parsed.intent === 'QUERY_BALANCE') {
      speakBalance(transcript)
      return
    }
    const draft = draftFromIntent(parsed, ledger)
    if (!draft) {
      setFeedback({ status: 'error', message: 'unknown', transcript })
      return
    }
    if (draft.kind !== 'employer' && !draft.employerId) {
      setFeedback({ status: 'error', message: 'chooseEmployer', transcript })
      return
    }
    const next: Editor = parsed.missing.length || parsed.ambiguity
      ? { draft, stage: 'edit', error: 'clarify', missing: parsed.missing }
      : reviewDraft(draft, ledger)
    setEditor(next)
    setFeedback({ status: 'awaiting', transcript })
  }

  function toggleMicrophone() {
    if (recognition.current) {
      recognition.current.stop()
      return
    }
    cancelSpeech()
    setFeedback({ status: 'starting' })
    recognition.current = speechToText.listen(locale, {
      started: () => setFeedback({ status: 'listening', startedAt: Date.now() }),
      sound: active => setFeedback(previous => previous.status === 'listening' ? { ...previous, sound: active } : previous),
      processing: () => setFeedback({ status: 'processing' }),
      recognized: transcript => {
        recognition.current = null
        handleCommand(transcript, 'speech')
      },
      failed: message => {
        recognition.current = null
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
          void ledgerStore.read().then(setLedger, () => setLoadingFailed(true))
        }}>{t.retry}</button>}
      </div>}
      <VoicePanel t={t} examples={language.examples} feedback={feedback} ready={Boolean(ledger) && !saving}
        available={speechToText.available()} onMic={toggleMicrophone}
        onCancel={() => { cancelSpeech(); setFeedback({ status: 'idle' }) }}
        onCommand={command => handleCommand(command, 'typed')} />
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
      <LocalFooter t={t} />
    </main>
    <EntryDialog editor={editor} t={t} locale={locale} employerName={employerName} transcript={feedback.transcript} saving={saving}
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
  </>
}
