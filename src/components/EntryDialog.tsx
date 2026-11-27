import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import type { Proposal, WorkEntry } from '../domain/ledger'
import { localDate } from '../domain/ledger'
import { dateLabel, money } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'

export type Draft = {
  kind: Proposal['kind']; employerId?: string; name: string; description: string
  rate: string; days: string; date: string; amount: string
}

export type Editor = {
  draft: Draft
  stage: 'edit' | 'conflict' | 'review'
  proposal?: Proposal
  existing?: WorkEntry
  error?: keyof Messages
}

export function EntryDialog({ editor, t, locale, employerName, transcript, saving, onChange, onReview, onEdit, onConfirm, onClose }: {
  editor: Editor | null; t: Messages; locale: Locale; employerName: string; saving: boolean
  transcript?: string
  onChange(patch: Partial<Draft>): void
  onReview(replace?: boolean): void
  onEdit(): void
  onConfirm(): void
  onClose(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const visible = editor !== null
  const stage = editor?.stage
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
  useEffect(() => { if (visible) heading.current?.focus() }, [visible, stage])

  const title = editor && (editor.stage === 'conflict' ? t.duplicateWork :
    editor.proposal?.kind === 'work' && editor.proposal.replaces ? t.replaceTitle :
    { employer: t.addEmployer, wage: t.editWage, work: t.work, payment: t.payment }[editor.draft.kind])
  const draft = editor?.draft
  const proposal = editor?.proposal
  const workOrPayment = draft?.kind === 'work' || draft?.kind === 'payment'

  return <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={event => {
    event.preventDefault()
    if (!saving) onClose()
  }}>
    {editor && draft && <div className="dialog-content">
      <div className="dialog-heading">
        <h2 id="dialog-title" ref={heading} tabIndex={-1}>{title}</h2>
        <button type="button" className="button close-button" aria-label={t.cancel} onClick={onClose} disabled={saving}><X size={22} /></button>
      </div>
      {draft.kind !== 'employer' && <p className="dialog-employer"><span>{t.worksite}</span><strong>{employerName}</strong></p>}
      {transcript && <p className="dialog-employer"><span>{t.heard}</span><strong>{transcript}</strong></p>}
      {editor.error && <p className="notice error" role="alert">{t[editor.error]}</p>}
      {editor.stage === 'edit' && <form onSubmit={event => { event.preventDefault(); onReview() }} className="entry-form">
        {draft.kind === 'employer' && <>
          <label>{t.name}<input required maxLength={80} value={draft.name} onChange={event => onChange({ name: event.target.value })} /></label>
          <label>{t.description}<textarea rows={2} maxLength={160} value={draft.description} onChange={event => onChange({ description: event.target.value })} /></label>
        </>}
        {(draft.kind === 'employer' || draft.kind === 'wage') &&
          <label>{t.wageInput}<input inputMode="decimal" required maxLength={20} value={draft.rate} onChange={event => onChange({ rate: event.target.value })} /></label>}
        {draft.kind === 'wage' && <p className="muted">{t.wageHint}</p>}
        {workOrPayment && <label>{t.date}<input type="date" required min="1900-01-01" max={localDate()}
          value={draft.date} onChange={event => onChange({ date: event.target.value })} /></label>}
        {draft.kind === 'work' && <label>{t.days}<input inputMode="numeric" required maxLength={3}
          value={draft.days} onChange={event => onChange({ days: event.target.value })} /></label>}
        {draft.kind === 'payment' && <label>{t.amount}<input inputMode="decimal" required maxLength={20}
          value={draft.amount} onChange={event => onChange({ amount: event.target.value })} /></label>}
        <div className="dialog-actions"><button className="button" type="button" onClick={onClose}>{t.cancel}</button>
          <button className="button primary" type="submit">{t.review}</button></div>
      </form>}
      {editor.stage === 'conflict' && editor.existing && <div>
        <dl className="review-details">
          <div><dt>{t.date}</dt><dd>{dateLabel(editor.existing.date, locale)}</dd></div>
          <div><dt>{t.previous}</dt><dd>{new Intl.NumberFormat(locale).format(editor.existing.days)}</dd></div>
        </dl>
        <div className="dialog-actions"><button className="button" type="button" onClick={onEdit}>{t.edit}</button>
          <button className="button primary" type="button" onClick={() => onReview(true)}>{t.replace}</button></div>
      </div>}
      {editor.stage === 'review' && proposal && <div>
        <dl className="review-details">
          {proposal.kind === 'employer' && <>
            <div><dt>{t.name}</dt><dd>{proposal.name}</dd></div>
            {proposal.description && <div><dt>{t.description}</dt><dd>{proposal.description}</dd></div>}
          </>}
          {'rate' in proposal && <div><dt>{t.wage}</dt><dd>{money(proposal.rate, locale)}</dd></div>}
          {'date' in proposal && <div><dt>{t.date}</dt><dd>{dateLabel(proposal.date, locale)}</dd></div>}
          {proposal.kind === 'work' && <>
            {editor.existing && <div><dt>{t.previous}</dt><dd>{new Intl.NumberFormat(locale).format(editor.existing.days)}</dd></div>}
            <div><dt>{t.days}</dt><dd>{new Intl.NumberFormat(locale).format(proposal.days)}</dd></div>
            <div><dt>{t.earned}</dt><dd>{money(proposal.days * proposal.rate, locale)}</dd></div>
          </>}
          {proposal.kind === 'payment' && <div><dt>{t.amount}</dt><dd>{money(proposal.amount, locale)}</dd></div>}
        </dl>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={onClose} disabled={saving}>{t.cancel}</button>
          <button className="button" type="button" onClick={onEdit} disabled={saving}>{t.edit}</button>
          <button className="button primary" type="button" onClick={onConfirm} disabled={saving}>
            <Check size={18} aria-hidden="true" />{saving ? t.saving : t.confirm}
          </button>
        </div>
      </div>}
    </div>}
  </dialog>
}
