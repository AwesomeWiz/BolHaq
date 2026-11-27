import { ArrowDownLeft, Banknote, Building2, CalendarDays, ClipboardList, Globe2, LockKeyhole, Plus, Volume2, Wallet } from 'lucide-react'
import { dateLabel, languages, money } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'
import { currentAgreement, totals } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'

export function AppHeader({ locale, t, onLanguage }: { locale: Locale; t: Messages; onLanguage(locale: Locale): void }) {
  return <header className="app-header">
    <div className="shell header-inner">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div><div className="wordmark" lang="en">BolHaq</div><div className="tagline">{t.tagline}</div></div>
      </div>
      <label className="language">
        <Globe2 size={18} aria-hidden="true" />
        <select aria-label={t.language} value={locale} onChange={event => onLanguage(event.target.value as Locale)}>
          {languages.map(language => <option key={language.code} lang={language.code} value={language.code}>{language.label}</option>)}
        </select>
      </label>
    </div>
  </header>
}

export function WageBalance({ t, locale, ledger, employerId, onSpeak }: {
  t: Messages; locale: Locale; ledger: Ledger; employerId: string | null; onSpeak(): void
}) {
  const value = totals(ledger, employerId ?? '')
  const number = new Intl.NumberFormat(locale)
  return <section className="balance-card" aria-labelledby="balance-title">
    <div className="balance-heading">
      <h2 id="balance-title"><Wallet size={19} aria-hidden="true" />{value.balance < 0 ? t.advance : t.outstanding}</h2>
      {employerId && <button type="button" className="balance-audio" aria-label={t.speakBalance} title={t.speakBalance} onClick={onSpeak}><Volume2 size={20} /></button>}
    </div>
    <p className="balance-value">{employerId ? money(Math.abs(value.balance), locale) : '—'}</p>
    <dl className="balance-stats">
      <div><dt>{t.days}</dt><dd>{employerId ? number.format(value.days) : '—'}</dd></div>
      <div><dt>{t.earned}</dt><dd>{employerId ? money(value.earned, locale) : '—'}</dd></div>
      <div><dt>{t.paid}</dt><dd>{employerId ? money(value.paid, locale) : '—'}</dd></div>
    </dl>
  </section>
}

export function EmployerCard({ t, locale, ledger, ready, onSelect, onAdd }: {
  t: Messages; locale: Locale; ledger: Ledger; ready: boolean; onSelect(id: string): void; onAdd(): void
}) {
  const employer = ledger.employers.find(item => item.id === ledger.activeId)
  const agreement = employer && currentAgreement(ledger, employer.id)
  return <section className="panel employer-card" aria-labelledby="employer-title">
    <div className="employer-heading">
      <div className="section-icon"><Building2 size={21} aria-hidden="true" /></div>
      <h2 id="employer-title">{t.worksite}</h2>
    </div>
    {employer ? <>
      <select className="employer-select" aria-labelledby="employer-title" value={employer.id} disabled={!ready}
        onChange={event => onSelect(event.target.value)}>
        {ledger.employers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {employer.description && <p className="muted employer-notes">{employer.description}</p>}
      {agreement && <p className="current-rate"><span>{t.wage}</span><strong>{money(agreement.rate, locale)}</strong></p>}
    </> : <p className="muted">{t.noEmployer}</p>}
    <button type="button" className="button add-worksite" onClick={onAdd} disabled={!ready}><Plus size={19} aria-hidden="true" />{t.addEmployer}</button>
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

export function TransactionList({ t, locale, ledger }: { t: Messages; locale: Locale; ledger: Ledger }) {
  const entries = [
    ...ledger.work.filter(entry => entry.employerId === ledger.activeId).map(entry => ({ ...entry, kind: 'work' as const })),
    ...ledger.payments.filter(entry => entry.employerId === ledger.activeId).map(entry => ({ ...entry, kind: 'payment' as const })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return <section className="panel activity-card" aria-labelledby="activity-title">
    <h2 id="activity-title"><ClipboardList size={20} aria-hidden="true" />{t.activity}</h2>
    {entries.length === 0 ? <p className="empty-state muted">{t.empty}</p> : <ul className="transactions">
      {entries.map(entry => <li key={entry.id}>
        <div className={`entry-icon ${entry.kind}`} aria-hidden="true">{entry.kind === 'work' ? <CalendarDays size={19} /> : <ArrowDownLeft size={19} />}</div>
        <div className="entry-info"><strong>{entry.kind === 'work' ? t.workEntry : t.paymentEntry}</strong>
          <div className="entry-meta muted"><time dateTime={entry.date}>{dateLabel(entry.date, locale)}</time>
            {entry.kind === 'work' && <span>{t.days} · {new Intl.NumberFormat(locale).format(entry.days)} · {money(entry.rate, locale)}</span>}</div>
        </div>
        <strong className="entry-amount">{entry.kind === 'work' ? money(entry.rate * entry.days, locale) : money(entry.amount, locale)}</strong>
      </li>)}
    </ul>}
  </section>
}

export function LocalFooter({ t }: { t: Messages }) {
  return <footer className="local-footer"><LockKeyhole size={15} aria-hidden="true" />{t.local}</footer>
}
