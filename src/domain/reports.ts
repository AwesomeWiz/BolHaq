import { localDate, totals, validDate } from './ledger'
import type { Ledger } from './ledger'

export type DateRange = { from: string; to: string }
export type Period = { kind: 'all' } | { kind: 'month'; month: string } | ({ kind: 'range' } & DateRange)

export function monthRange(month: string, today = localDate()): DateRange | null {
  const from = month + '-01'
  if (!validDate(from, today)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const end = month + '-' + String(lastDay).padStart(2, '0')
  return { from, to: end < today ? end : today }
}

export function resolvePeriod(period: Period, today = localDate()): DateRange | null {
  if (period.kind === 'all') return { from: '1900-01-01', to: today }
  if (period.kind === 'month') return monthRange(period.month, today)
  const { from, to } = period
  return from <= to && validDate(from, today) && validDate(to, today) ? { from, to } : null
}

export function wageStatement(ledger: Ledger, employerId: string, range: DateRange) {
  const employer = ledger.employers.find(site => site.id === employerId)
  if (!employer) return null
  const inPeriod = (entry: { employerId: string; date: string }) =>
    entry.employerId === employerId && entry.date >= range.from && entry.date <= range.to
  const records = [
    ...ledger.work.filter(inPeriod).map(entry => ({ kind: 'work' as const, ...entry })),
    ...ledger.payments.filter(inPeriod).map(entry => ({ kind: 'payment' as const, ...entry })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return {
    employer, range, records,
    period: totals(ledger, employerId, range),
    balance: totals(ledger, employerId, { to: range.to }).balance,
  }
}

export function worksiteOverview(ledger: Ledger, range?: DateRange) {
  let owed = 0n
  let advances = 0n
  let earned = 0n
  let paid = 0n
  const grouped = new Map(ledger.employers.map(site => [site.id, {
    work: [] as Ledger['work'], payments: [] as Ledger['payments'],
  }]))
  for (const work of ledger.work) grouped.get(work.employerId)?.work.push(work)
  for (const payment of ledger.payments) grouped.get(payment.employerId)?.payments.push(payment)
  const sites = ledger.employers.map(employer => {
    const entries = grouped.get(employer.id)!
    const lifetime = totals(entries, employer.id)
    const activity = range ? totals(entries, employer.id, range) : lifetime
    owed += BigInt(Math.max(0, lifetime.balance))
    advances += BigInt(Math.max(0, -lifetime.balance))
    earned += BigInt(activity.earned)
    paid += BigInt(activity.paid)
    return { employer, balance: lifetime.balance, earned: activity.earned, paid: activity.paid }
  })
  return { sites, owed, advances, earned, paid }
}

export function matchWorksite(ledger: Ledger, name: string) {
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
  const key = normalize(name)
  const matches = ledger.employers.filter(site => normalize(site.name) === key)
  return matches.length === 1 ? matches[0] : undefined
}
