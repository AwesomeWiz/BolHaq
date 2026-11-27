import { useState } from 'react'
import { ChevronRight, Printer } from 'lucide-react'
import { localDate, totals } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'
import { resolvePeriod, wageStatement, worksiteOverview } from '../domain/reports'
import type { DateRange, Period } from '../domain/reports'
import { balanceLabel, paymentReminder, spanLabel, statementText } from '../features/wageDocuments'
import { dateLabel, languages, money } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'
import { wageTools } from '../locales/wageTools'
import type { ToolMessages } from '../locales/wageTools'
import { LanguagePicker } from './LanguagePicker'
import { ShareActions } from './ShareActions'

export type ReportView = { view: 'statement' | 'reminder' | 'overview'; siteId?: string; period?: Period }

function PeriodFields({ period, today, w, onChange }: {
  period: Period; today: string; w: ToolMessages; onChange(value: Period): void
}) {
  const month = today.slice(0, 7)
  return <>
    <label>{w.period}
      <select value={period.kind} onChange={event => {
        switch (event.target.value) {
          case 'all': onChange({ kind: 'all' }); break
          case 'month': onChange({ kind: 'month', month }); break
          case 'range': onChange({ kind: 'range', from: month + '-01', to: today })
        }
      }}>
        <option value="all">{w.allTime}</option>
        <option value="month">{w.byMonth}</option>
        <option value="range">{w.custom}</option>
      </select>
    </label>
    {period.kind === 'month' && <label>{w.byMonth}
      <input type="month" value={period.month} min="1900-01" max={month} placeholder="YYYY-MM"
        onChange={event => onChange({ kind: 'month', month: event.target.value })} />
    </label>}
    {period.kind === 'range' && <>
      <label>{w.from}<input type="date" value={period.from} min="1900-01-01" max={today}
        onChange={event => onChange({ ...period, from: event.target.value })} /></label>
      <label>{w.to}<input type="date" value={period.to} min="1900-01-01" max={today}
        onChange={event => onChange({ ...period, to: event.target.value })} /></label>
    </>}
  </>
}

function Statement({ report, generated, locale, t, w, allDates }: {
  report: NonNullable<ReturnType<typeof wageStatement>>; generated: string; locale: Locale
  t: Messages; w: ToolMessages; allDates: boolean
}) {
  const { employer, period, range, records, balance } = report
  const number = new Intl.NumberFormat(locale)
  const currency = (paise: number) => money(paise, locale)
  return <>
    <article className="wage-print" aria-label={w.statement}>
      <header className="statement-header">
        <strong lang="en" className="wordmark">BolHaq</strong>
        <span className="print-statement-title">{w.statement}</span>
        <h3>{employer.name}</h3>
        <p>{allDates ? w.allTime : spanLabel(range, locale)} · {w.generated.replace('{date}', dateLabel(generated, locale))}</p>
      </header>
      <dl className="tool-metrics">
        <div><dt>{t.days}</dt><dd>{number.format(period.days)}</dd></div>
        <div><dt>{t.earned}</dt><dd>{currency(period.earned)}</dd></div>
        <div><dt>{t.paid}</dt><dd className="receipt-text">{currency(period.paid)}</dd></div>
        <div><dt>{w.net}</dt><dd>{currency(period.balance)}</dd></div>
      </dl>
      <div className="report-balance">
        <p>{w.asOf.replace('{date}', dateLabel(range.to, locale))}</p>
        <strong>{balanceLabel(balance, locale)} · {currency(Math.abs(balance))}</strong>
      </div>
      <h3>{w.records}</h3>
      {records.length === 0 ? <p className="muted">{w.emptyPeriod}</p> : <ul className="report-rows">
        {records.map(entry => <li key={entry.id}>
          <div><strong>{entry.kind === 'work' ? t.workEntry : t.paymentEntry}</strong>
            <p className="muted"><time dateTime={entry.date}>{dateLabel(entry.date, locale)}</time>
              {entry.kind === 'work' && ` · ${number.format(entry.days)} × ${currency(entry.rate)}`}</p>
          </div>
          <strong className={entry.kind === 'payment' ? 'receipt-text' : undefined}>
            {entry.kind === 'payment' ? '+ ' + currency(entry.amount) : currency(entry.rate * entry.days)}
          </strong>
        </li>)}
      </ul>}
      <p className="tool-disclaimer">{w.disclaimer}</p>
    </article>
    <button className="button print-action" type="button" onClick={() => window.print()}>
      <Printer size={18} aria-hidden="true" />{w.print}
    </button>
    <ShareActions title={w.statement} text={statementText(report, locale, generated, allDates)} w={w} />
  </>
}

function Overview({ ledger, range, period, locale, t, w, onStatement }: {
  ledger: Ledger; range: DateRange; period: Period; locale: Locale; t: Messages; w: ToolMessages
  onStatement(siteId: string, period: Period): void
}) {
  const summary = worksiteOverview(ledger, period.kind === 'all' ? undefined : range)
  const number = new Intl.NumberFormat(locale)
  return <>
    <h3>{w.currentBalances}</h3>
    <dl className="tool-metrics">
      <div><dt>{t.outstanding}</dt><dd>{money(summary.owed, locale)}</dd></div>
      <div><dt>{t.advance}</dt><dd>{money(summary.advances, locale)}</dd></div>
      <div><dt>{w.worksiteCount}</dt><dd>{number.format(summary.sites.length)}</dd></div>
    </dl>
    <h3>{w.periodActivity}</h3>
    <p className="muted">{period.kind === 'all' ? w.allTime : spanLabel(range, locale)}</p>
    <dl className="tool-metrics">
      <div><dt>{t.earned}</dt><dd>{money(summary.earned, locale)}</dd></div>
      <div><dt>{t.paid}</dt><dd className="receipt-text">{money(summary.paid, locale)}</dd></div>
    </dl>
    {summary.sites.length === 0 ? <p className="muted">{w.noWorksites}</p> : <ul className="report-rows overview-rows">
      {summary.sites.map(site => <li key={site.employer.id}>
        <button className="overview-site" type="button" aria-label={w.siteDetails.replace('{name}', () => site.employer.name)}
          onClick={() => onStatement(site.employer.id, period)}>
          <span><strong>{site.employer.name}</strong>
            <span className="muted">{t.earned} {money(site.earned, locale)} · {t.paid} {money(site.paid, locale)}</span>
          </span>
          <span className="site-balance"><span className="muted">{balanceLabel(site.balance, locale)}</span>
            <strong>{money(Math.abs(site.balance), locale)}</strong></span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
  </>
}

function Reminder({ ledger, siteId, locale, range, w }: {
  ledger: Ledger; siteId: string; locale: Locale; range?: DateRange; w: ToolMessages
}) {
  const [outgoing, setOutgoing] = useState(locale)
  const [edited, setEdited] = useState<string>()
  const draft = paymentReminder(ledger, siteId, outgoing, range)
  if (!draft) {
    const balance = totals(ledger, siteId).balance
    return <div className="report-balance"><strong>{balanceLabel(balance, locale)} · {money(Math.abs(balance), locale)}</strong>
      <p>{w.noDemand}</p></div>
  }

  return <>
    <div className="message-language"><span>{w.outgoingLanguage}</span>
      <LanguagePicker locale={outgoing} label={w.outgoingLanguage} onSelect={next => {
        if (outgoing !== next) { setOutgoing(next); setEdited(undefined) }
      }} />
    </div>
    <label className="message-preview">{w.messagePreview}
      <textarea lang={outgoing} rows={8} value={edited ?? draft} maxLength={2000} onChange={event => setEdited(event.target.value)} />
    </label>
    {edited !== undefined && <button type="button" className="button" onClick={() => setEdited(undefined)}>{w.regenerate}</button>}
    <ShareActions title={wageTools(outgoing).reminder} text={edited ?? draft} w={w} whatsapp />
  </>
}

export function WageReports({ view, ledger, locale, onStatement }: {
  view: ReportView; ledger: Ledger; locale: Locale; onStatement(siteId: string, period: Period): void
}) {
  const [today] = useState(localDate)
  const [period, setPeriod] = useState<Period>(view.period ??
    (view.view === 'statement' ? { kind: 'month', month: today.slice(0, 7) } : { kind: 'all' }))
  const [siteId, setSiteId] = useState(view.siteId ?? '')
  const { messages: t } = languages.find(language => language.code === locale)!
  const w = wageTools(locale)
  const range = resolvePeriod(period, today)
  const overview = view.view === 'overview'
  const employer = ledger.employers.find(site => site.id === siteId)
  const report = view.view === 'statement' && range && employer ? wageStatement(ledger, employer.id, range) : null

  return <>
    <div className="tool-filters">
      {!overview && <label>{t.worksite}
        <select value={siteId} onChange={event => setSiteId(event.target.value)}>
          <option value="">{t.chooseEmployer}</option>
          {ledger.employers.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </label>}
      <PeriodFields period={period} today={today} w={w} onChange={setPeriod} />
    </div>
    {!range && <p className="notice error" role="alert">{w.invalidPeriod}</p>}
    {!overview && !employer && <p className="notice">{ledger.employers.length ? w.unmatched : w.noWorksites}</p>}
    {overview && range && <Overview ledger={ledger} range={range} period={period} locale={locale} t={t} w={w} onStatement={onStatement} />}
    {report && <Statement report={report} generated={today} locale={locale} t={t} w={w} allDates={period.kind === 'all'} />}
    {view.view === 'reminder' && employer && range && <Reminder key={`${employer.id}:${period.kind}:${range.from}:${range.to}`}
      ledger={ledger} siteId={employer.id} locale={locale} w={w} range={period.kind === 'all' ? undefined : range} />}
  </>
}
