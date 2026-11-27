import { localDate, maxPaise, validDate } from './ledger'
import type { Employer, Ledger, PaymentEntry, WageAgreement, WorkEntry } from './ledger'

export const backupSizeLimit = 10_000_000
const appId = 'bolhaq'
const formatVersion = 1

export type BackupIssue = 'badBackup' | 'backupVersion' | 'backupLarge'
export class BackupError extends Error {
  constructor(readonly issue: BackupIssue) { super(issue) }
}

type Backup = { appId: typeof appId; version: typeof formatVersion; exportedAt: string; ledger: Ledger }

function invalid(): never { throw new BackupError('badBackup') }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field))
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && value.trim().length > 0
}

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function positiveInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= max
}

function employer(value: unknown): value is Employer {
  return hasFields(value, ['id', 'name', 'description', 'createdAt']) &&
    identifier(value.id) && timestamp(value.createdAt) &&
    typeof value.name === 'string' && !!value.name.trim() && value.name.trim().length <= 80 &&
    typeof value.description === 'string' && value.description.length <= 160
}

function agreement(value: unknown): value is WageAgreement {
  return hasFields(value, ['id', 'employerId', 'rate', 'createdAt']) &&
    identifier(value.id) && identifier(value.employerId) && timestamp(value.createdAt) && positiveInteger(value.rate, maxPaise)
}

function work(value: unknown, today: string): value is WorkEntry {
  return hasFields(value, ['id', 'employerId', 'date', 'days', 'rate', 'createdAt']) &&
    identifier(value.id) && identifier(value.employerId) && timestamp(value.createdAt) &&
    typeof value.date === 'string' && validDate(value.date, today) &&
    positiveInteger(value.days, 366) && positiveInteger(value.rate, maxPaise)
}

function payment(value: unknown, today: string): value is PaymentEntry {
  return hasFields(value, ['id', 'employerId', 'date', 'amount', 'createdAt']) &&
    identifier(value.id) && identifier(value.employerId) && timestamp(value.createdAt) &&
    typeof value.date === 'string' && validDate(value.date, today) && positiveInteger(value.amount, maxPaise)
}

function records<T>(input: unknown, check: (value: unknown) => value is T): T[] {
  if (!Array.isArray(input) || !input.every(check)) invalid()
  return input
}

function restoreLedger(data: unknown, latestDate: string): Ledger {
  if (!hasFields(data, ['employers', 'agreements', 'work', 'payments', 'activeId'])) invalid()
  const employers = records(data.employers, employer)
  const agreements = records(data.agreements, agreement)
  const workEntries = records(data.work, (value): value is WorkEntry => work(value, latestDate))
  const payments = records(data.payments, (value): value is PaymentEntry => payment(value, latestDate))
  const sites = new Map(employers.map(site => [site.id, site]))
  if (sites.size !== employers.length) invalid()

  const ids = new Set(sites.keys())
  const rates = new Map<string, Set<number>>()
  for (const row of agreements) {
    const site = sites.get(row.employerId)
    if (!site) invalid()
    const existingRates = rates.get(site.id)
    // A worksite and its first agreement intentionally share one ID in the current ledger.
    const isInitial = row.id === site.id && !existingRates && row.createdAt === site.createdAt
    if (ids.has(row.id) && !isInitial) invalid()
    ids.add(row.id)
    const siteRates = existingRates ?? new Set<number>()
    siteRates.add(row.rate)
    rates.set(site.id, siteRates)
  }
  if (rates.size !== sites.size) invalid()

  const dates = new Map<string, Set<string>>()
  const earnings = new Map<string, number>()
  const received = new Map<string, number>()
  function addAmount(totals: Map<string, number>, id: string, amount: number) {
    const total = (totals.get(id) ?? 0) + amount
    if (!Number.isSafeInteger(total)) invalid()
    totals.set(id, total)
  }
  for (const row of workEntries) {
    if (ids.has(row.id) || !rates.get(row.employerId)?.has(row.rate)) invalid()
    ids.add(row.id)
    const siteDates = dates.get(row.employerId) ?? new Set<string>()
    if (siteDates.has(row.date)) invalid()
    siteDates.add(row.date)
    dates.set(row.employerId, siteDates)
    addAmount(earnings, row.employerId, row.rate * row.days)
  }
  for (const row of payments) {
    if (ids.has(row.id) || !sites.has(row.employerId)) invalid()
    ids.add(row.id)
    addAmount(received, row.employerId, row.amount)
  }

  const id = data.activeId
  if (id !== null && (typeof id !== 'string' || !sites.has(id))) invalid()
  return { employers, agreements, work: workEntries, payments, activeId: id ?? employers[0]?.id ?? null }
}

function checkSize(content: string) {
  if (content.length > backupSizeLimit || new TextEncoder().encode(content).byteLength > backupSizeLimit) {
    throw new BackupError('backupLarge')
  }
}

export function exportBackup(ledger: Ledger, now = new Date()) {
  const backup: Backup = { appId, version: formatVersion, exportedAt: now.toISOString(), ledger }
  const content = JSON.stringify(backup, null, 2)
  checkSize(content)
  return { content, filename: `BolHaq-Backup-${localDate(now)}.json` }
}

export function readBackup(content: string, today = localDate()): Backup {
  checkSize(content)
  let raw: unknown
  try { raw = JSON.parse(content) } catch { return invalid() }
  if (!isObject(raw) || raw.appId !== appId || !Object.hasOwn(raw, 'version')) return invalid()
  if (raw.version !== formatVersion) throw new BackupError('backupVersion')
  if (!hasFields(raw, ['appId', 'version', 'exportedAt', 'ledger']) || !timestamp(raw.exportedAt)) return invalid()
  // Cover dates recorded on a device ahead of UTC, without allowing arbitrarily future work.
  const exportDay = new Date(new Date(raw.exportedAt).valueOf() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { appId, version: formatVersion, exportedAt: raw.exportedAt, ledger: restoreLedger(raw.ledger, exportDay > today ? exportDay : today) }
}
