import { ArrowDownLeft, Banknote, Building2, CalendarDays, ChevronDown, ClipboardList, LockKeyhole, Plus, Volume2, Wallet } from 'lucide-react'
import { dateLabel, money } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'
import { currentAgreement, totals } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'
import { LanguagePicker } from './LanguagePicker'

export function AppHeader({ locale, t, onLanguage }: { locale: Locale; t: Messages; onLanguage(locale: Locale): void }) {
  return <header className="app-header">
    <div className="shell header-inner">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div><div className="wordmark" lang="en">BolHaq</div><div className="tagline">{t.tagline}</div></div>
      </div>
      <LanguagePicker locale={locale} label={t.language} onSelect={onLanguage} />
    </div>
  </header>
}

export function WageBalance({ t, locale, ledger, employerId, playback, onSpeak }: {
  t: Messages; locale: Locale; ledger: Ledger; employerId: string | null
  playback?: keyof Messages; onSpeak(): void
}) {
  const value = totals(ledger, employerId ?? '')
  const number = new Intl.NumberFormat(locale)
  const label = value.balance < 0 ? t.advance : value.earned > 0 && value.balance === 0 ? t.settled : t.outstanding
  return <section className="balance-card" aria-labelledby="balance-title">
    <div className="balance-heading">
      <h2 id="balance-title">{label}</h2>
      {employerId && <button type="button" className="button balance-audio" aria-label={t.speakBalance} title={t.speakBalance}
        onClick={onSpeak}><Volume2 size={20} aria-hidden="true" /></button>}
    </div>
    <div className="balance-announcement" aria-live="polite" aria-atomic="true">
      <p className="balance-value" key={`${employerId}:${value.balance}`}>{employerId ? money(Math.abs(value.balance), locale) : '—'}</p>
    </div>
    <dl className="balance-stats">
      <div><dt>{t.days}</dt><dd>{employerId ? number.format(value.days) : '—'}</dd></div>
      <div><dt>{t.earned}</dt><dd>{employerId ? money(value.earned, locale) : '—'}</dd></div>
      <div><dt>{t.paid}</dt><dd className={employerId && value.paid ? 'receipt-text' : undefined}>
        {employerId ? money(value.paid, locale) : '—'}</dd></div>
    </dl>
    <p className="playback-status" role="status">{playback && t[playback]}</p>
  </section>
}

export function EmployerCard({ t, locale, ledger, ready, onSelect, onAdd }: {
  t: Messages; locale: Locale; ledger: Ledger; ready: boolean; onSelect(id: string): void; onAdd(): void
}) {
  const employer = ledger.employers.find(item => item.id === ledger.activeId)
  const agreement = employer && currentAgreement(ledger, employer.id)
  return <section className="employer-card" aria-labelledby="employer-title">
    <div className="employer-row" data-empty={!employer || undefined}>
      <div className="section-icon"><Building2 size={21} aria-hidden="true" /></div>
      <div className="employer-heading">
        <h2 id="employer-title">{t.worksite}</h2>
        {employer && <div className="employer-select-wrap">
          <select className="employer-select" aria-labelledby="employer-title" value={employer.id} disabled={!ready}
            onChange={event => onSelect(event.target.value)}>
            {ledger.employers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>}
      </div>
      <button type="button" className="button add-worksite" data-tour-target="site" onClick={onAdd} disabled={!ready}
        aria-label={t.addEmployer} title={t.addEmployer}>
        <Plus size={21} aria-hidden="true" />{!employer && <span>{t.addEmployer}</span>}
      </button>
    </div>
    {employer ? <>
      {employer.description && <p className="muted employer-notes">{employer.description}</p>}
      {agreement && <p className="current-rate"><span>{t.wage}</span><strong>{money(agreement.rate, locale)}</strong></p>}
    </> : <p className="muted employer-notes">{t.noEmployer}</p>}
  </section>
}

export function ManualActions({ t, ready, onAction }: {
  t: Messages; ready: boolean; onAction(kind: 'work' | 'payment' | 'wage'): void
}) {
  const actions = [
    { kind: 'work', label: t.work, Icon: CalendarDays },
    { kind: 'payment', label: t.payment, Icon: Banknote },
    { kind: 'wage', label: t.editWage, Icon: Wallet },
  ] as const
  return <section className="quick-actions" aria-labelledby="actions-title">
    <h2 id="actions-title">{t.manual}</h2>
    <div className="action-grid">
      {actions.map(({ kind, label, Icon }) => <button className="action-button" type="button" key={kind}
        disabled={!ready} onClick={() => onAction(kind)}><Icon size={20} aria-hidden="true" />{label}</button>)}
    </div>
  </section>
}

export function TransactionList({ t, locale, ledger, lastSavedId }: {
  t: Messages; locale: Locale; ledger: Ledger; lastSavedId?: string
}) {
  const employer = ledger.employers.find(item => item.id === ledger.activeId)
  const entries = [
    ...ledger.work.filter(entry => entry.employerId === employer?.id).map(entry => ({ ...entry, kind: 'work' as const })),
    ...ledger.payments.filter(entry => entry.employerId === employer?.id).map(entry => ({ ...entry, kind: 'payment' as const })),
  ].sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const group = groups.get(entry.date)
    if (group) group.push(entry)
    else groups.set(entry.date, [entry])
  }
  const number = new Intl.NumberFormat(locale)

  return <section className="panel activity-card" aria-labelledby="activity-title">
    <h2 id="activity-title">{t.activity}</h2>
    {groups.size === 0 ? <div className="empty-state"><ClipboardList size={22} aria-hidden="true" /><p>{t.empty}</p></div> :
      [...groups].map(([date, transactions]) => <div key={date} className="activity-group">
        <h3><time dateTime={date}>{dateLabel(date, locale)}</time></h3>
        <ul className="transactions">
          {transactions.map(entry => <li key={entry.id} data-new={lastSavedId === entry.id || undefined}>
            <div className={`entry-icon ${entry.kind}`} aria-hidden="true">
              {entry.kind === 'work' ? <CalendarDays size={19} /> : <ArrowDownLeft size={19} />}</div>
            <div className="entry-info"><strong>{entry.kind === 'work' ? t.workEntry : t.paymentEntry}</strong>
              <p className="entry-meta">{employer?.name}
                {entry.kind === 'work' && <span>{t.days} · {number.format(entry.days)}</span>}</p>
            </div>
            <strong className={`entry-amount ${entry.kind === 'payment' ? 'receipt-text' : ''}`}>
              {entry.kind === 'work' ? money(entry.rate * entry.days, locale) : `+ ${money(entry.amount, locale)}`}
            </strong>
          </li>)}
        </ul>
      </div>)}
  </section>
}

export function LocalFooter({ t }: { t: Messages }) {
  return <footer className="local-footer"><LockKeyhole size={15} aria-hidden="true" />{t.local}</footer>
}
