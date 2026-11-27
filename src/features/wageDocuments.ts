import { localDate, totals } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'
import { wageStatement } from '../domain/reports'
import type { DateRange } from '../domain/reports'
import { dateLabel, languages, money } from '../locales'
import type { Locale } from '../locales'
import { wageTools } from '../locales/wageTools'

type Statement = NonNullable<ReturnType<typeof wageStatement>>

export function spanLabel(range: DateRange, locale: Locale) {
  return `${dateLabel(range.from, locale)} – ${dateLabel(range.to, locale)}`
}

export function balanceLabel(balance: number, locale: Locale) {
  const { messages: t } = languages.find(language => language.code === locale)!
  return balance > 0 ? t.outstanding : balance < 0 ? t.advance : t.settled
}

export function statementText(statement: Statement, locale: Locale, generated = localDate(), allDates = false) {
  const { messages: t } = languages.find(language => language.code === locale)!
  const w = wageTools(locale)
  const { employer, period, range, records, balance } = statement
  const number = new Intl.NumberFormat(locale)
  const currency = (paise: number) => money(paise, locale)
  return [
    `BolHaq · ${w.statement}`, employer.name, allDates ? w.allTime : spanLabel(range, locale),
    w.generated.replace('{date}', dateLabel(generated, locale)),
    `${t.days} · ${number.format(period.days)}`, `${t.earned} · ${currency(period.earned)}`,
    `${t.paid} · ${currency(period.paid)}`, `${w.net} · ${currency(period.balance)}`,
    `${w.asOf.replace('{date}', dateLabel(range.to, locale))} · ${balanceLabel(balance, locale)} · ${currency(Math.abs(balance))}`,
    '',
    ...(records.length ? records.map(entry => {
      const date = dateLabel(entry.date, locale)
      return entry.kind === 'work'
        ? `${date} · ${t.workEntry} · ${number.format(entry.days)} × ${currency(entry.rate)} · ${currency(entry.days * entry.rate)}`
        : `${date} · ${t.paymentEntry} · + ${currency(entry.amount)}`
    }) : [w.emptyPeriod]),
    '', w.disclaimer,
  ].join('\n')
}

export function paymentReminder(ledger: Ledger, employerId: string, locale: Locale, range?: DateRange) {
  const employer = ledger.employers.find(site => site.id === employerId)
  if (!employer) return ''
  const current = totals(ledger, employerId)
  if (current.balance <= 0) return ''
  const { messages: t } = languages.find(language => language.code === locale)!
  const w = wageTools(locale)
  const activity = range ? totals(ledger, employerId, range) : current
  return [
    w.messageGreeting.replace('{name}', () => employer.name),
    range ? `${w.period} · ${spanLabel(range, locale)}` : w.allTime,
    `${t.earned} · ${money(activity.earned, locale)}`,
    `${t.paid} · ${money(activity.paid, locale)}`,
    `${w.currentOwed} · ${money(current.balance, locale)}`,
    w.messageRequest,
  ].join('\n')
}
