import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { localDate } from '../domain/ledger'
import type { Employer } from '../domain/ledger'
import { withInlineEdits } from '../features/proposals'
import type { Draft, Editor } from '../features/proposals'
import { dateLabel, money } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'
import { WorksiteSelect } from './WorksiteChoice'

type Field = Exclude<keyof Draft, 'kind' | 'employerId'>
const fields: Record<Draft['kind'], Field[]> = {
  employer: ['name', 'rate', 'description'], wage: ['rate'], work: ['days', 'date'], payment: ['amount', 'date'],
}

function EntryField({ draft, field, t, reviewing, onChange }: {
  draft: Draft; field: Field; t: Messages; reviewing: boolean; onChange(patch: Partial<Draft>): void
}) {
  const label = {
    name: t.name, description: t.description, rate: t.wageInput, days: t.days, date: t.date, amount: t.amount,
  }[field]
  const name = field === 'name'
  const count = field === 'days'
  const date = field === 'date'
  const change = (value: string) => onChange({ [field]: value })
  return <label>{label}
    {field === 'description' ? <textarea name={field} rows={2} maxLength={160} value={draft[field]}
      onChange={event => change(event.target.value)} /> :
      <input name={field} className={reviewing && !name ? 'inline-amount' : undefined} required
        type={date ? 'date' : 'text'} min={date ? '1900-01-01' : undefined} max={date ? localDate() : undefined}
        inputMode={name || date ? undefined : count ? 'numeric' : 'decimal'}
        maxLength={name ? 80 : count ? 3 : date ? undefined : 20}
        value={draft[field]} onChange={event => change(event.target.value)} />}
  </label>
}

export function EntryDialog({ editor, t, locale, employerName, employers, transcript, saving, onChange, onReview, onEdit, onConfirm, onClose, onRetry }: {
  editor: Editor | null; t: Messages; locale: Locale; employerName: string; saving: boolean
  employers: readonly Employer[]
  transcript?: string
  onRetry?(): void
  onChange(patch: Partial<Draft>): void
  onReview(replace?: boolean): void
  onEdit(): void
  onConfirm(): void
  onClose(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const visible = editor !== null
  const stage = editor?.stage
  const firstMissing = editor?.missing?.[0]
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (visible && !element.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      element.showModal()
    }
    if (!visible && element.open) {
      element.close()
      returnFocus.current?.focus()
    }
  }, [visible])
  useEffect(() => {
    if (!visible) return
    const missingField = firstMissing && form.current?.elements.namedItem(firstMissing)
    if (missingField instanceof HTMLElement) missingField.focus()
    else heading.current?.focus()
  }, [visible, stage, firstMissing])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  function closeSheet() {
    if (saving || closing) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    closeTimer.current = setTimeout(() => { setClosing(false); onClose() }, 140)
  }

  const draft = editor?.draft
  const proposal = editor?.proposal && withInlineEdits(editor.proposal, editor.draft)
  const reviewing = editor?.stage === 'review' && Boolean(proposal)
  const title = editor && (editor.stage === 'conflict' ? t.duplicateWork :
    proposal?.kind === 'work' && proposal.replaces ? t.replaceTitle :
    { employer: t.addEmployer, wage: t.editWage, work: t.work, payment: t.payment }[editor.draft.kind])
  const displayAmount = proposal?.kind === 'work' ? proposal.days * proposal.rate :
    proposal?.kind === 'payment' ? proposal.amount : proposal?.rate
  const canEditDetails = draft?.kind !== 'wage'
  const blocked = saving || closing
  const chooseWorksite = editor?.stage === 'edit' && editor.chooseWorksite
  const selectedFields = draft && (reviewing ? fields[draft.kind].filter(field => field !== 'date' && field !== 'description') : fields[draft.kind])
  const amountLabel = proposal?.kind === 'work' ? t.earned : proposal?.kind === 'payment' ? t.paymentEntry : t.wage

  return <dialog className="entry-dialog" ref={dialog} data-closing={closing || undefined}
    aria-labelledby="dialog-title" aria-busy={saving} onCancel={event => {
      event.preventDefault()
      closeSheet()
    }}>
    {editor && draft && <div className="dialog-content">
      <div className="dialog-heading">
        <h2 id="dialog-title" ref={heading} tabIndex={-1}>{title}</h2>
        <button type="button" className="button close-button" aria-label={t.closeDialog} onClick={closeSheet}
          disabled={blocked}><X size={22} aria-hidden="true" /></button>
      </div>
      {reviewing && <div className="confirmation-amount">
        <span>{amountLabel}</span><strong className="confirmation-value">{displayAmount ? money(displayAmount, locale) : '—'}</strong>
      </div>}
      {draft.kind !== 'employer' && !chooseWorksite && <p className="dialog-employer">{t.worksite} · <strong>{employerName}</strong></p>}
      {editor.error && <p className="notice error" role="alert">{t[editor.error]}</p>}
      {editor.stage === 'conflict' && editor.existing && <>
        <dl className="review-details">
          <div><dt>{t.date}</dt><dd>{dateLabel(editor.existing.date, locale)}</dd></div>
          <div><dt>{t.previous}</dt><dd>{new Intl.NumberFormat(locale).format(editor.existing.days)}</dd></div>
        </dl>
        <div className="dialog-actions">
          <button className="button" type="button" disabled={blocked} onClick={closeSheet}>{t.cancel}</button>
          <button className="button" type="button" disabled={blocked} onClick={onEdit}>{t.edit}</button>
          <button className="button primary" type="button" disabled={blocked} onClick={() => onReview(true)}>{t.replace}</button>
        </div>
      </>}
      {editor.stage !== 'conflict' && <form ref={form} onSubmit={event => {
        event.preventDefault()
        if (!reviewing && !blocked) onReview()
      }} className="entry-form">
        {reviewing && proposal && ('date' in proposal || proposal.kind === 'employer' && proposal.description) && <dl className="review-details">
          {'date' in proposal && <div><dt>{t.date}</dt><dd>{dateLabel(proposal.date, locale)}</dd></div>}
          {proposal.kind === 'work' && <>
            <div><dt>{t.wage}</dt><dd>{money(proposal.rate, locale)}</dd></div>
            {editor.existing && <div><dt>{t.previous}</dt><dd>{new Intl.NumberFormat(locale).format(editor.existing.days)}</dd></div>}
          </>}
          {proposal.kind === 'employer' && <div><dt>{t.description}</dt><dd>{proposal.description}</dd></div>}
        </dl>}
        <fieldset className="entry-fields" disabled={blocked}>
          {chooseWorksite && <WorksiteSelect employers={employers} locale={locale} t={t} value={draft.employerId}
            onChange={employerId => onChange({ employerId: employerId || undefined })} />}
          {selectedFields?.map(field => <EntryField key={field} draft={draft} field={field} t={t} reviewing={reviewing} onChange={onChange} />)}
        </fieldset>
        {draft.kind === 'wage' && <p className="muted">{t.wageHint}</p>}
        {transcript && <p className="dialog-transcript"><span>{t.heard}</span>{transcript}</p>}
        <div className="dialog-actions">
          <button className="button" type="button" disabled={blocked} onClick={closeSheet}>{t.cancel}</button>
          {!reviewing && onRetry && <button className="button" type="button" disabled={blocked} onClick={onRetry}>{t.editCommand}</button>}
          {reviewing ? <>
            {canEditDetails && <button className="button" type="button" disabled={blocked} onClick={onEdit}>{t.editDetails}</button>}
            <button className="button primary" type="button" disabled={blocked}
              onClick={() => { if (form.current?.reportValidity()) onConfirm() }}>
              <Check size={18} aria-hidden="true" />{saving ? t.saving : t.confirm}
            </button>
          </> : <button className="button primary" disabled={blocked} type="submit">{t.review}</button>}
        </div>
      </form>}
    </div>}
  </dialog>
}
