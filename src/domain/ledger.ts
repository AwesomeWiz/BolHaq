export type Employer = { id: string; name: string; description: string; createdAt: string }
export type WageAgreement = { id: string; employerId: string; rate: number; createdAt: string }
export type WorkEntry = { id: string; employerId: string; date: string; days: number; rate: number; createdAt: string }
export type PaymentEntry = { id: string; employerId: string; date: string; amount: number; createdAt: string }

export type Ledger = {
  employers: Employer[]
  agreements: WageAgreement[]
  work: WorkEntry[]
  payments: PaymentEntry[]
  activeId: string | null
}

export const emptyLedger = (): Ledger => ({
  employers: [], agreements: [], work: [], payments: [], activeId: null,
})

type Command =
  | { kind: 'employer'; name: string; description: string; rate: number }
  | { kind: 'wage'; employerId: string; rate: number; agreementId: string }
  | { kind: 'work'; employerId: string; date: string; days: number; rate: number; agreementId: string; replaces?: string }
  | { kind: 'payment'; employerId: string; date: string; amount: number }

export type Proposal = Command & { id: string }
export type LedgerIssue = 'invalid' | 'chooseEmployer' | 'duplicateWork' | 'changed' | 'overflow'
export class LedgerError extends Error {
  constructor(readonly issue: LedgerIssue) {
    super(issue)
  }
}

// Rupees are parsed as decimal text to avoid floating-point rounding at input.
export const maxPaise = 999_999_999
export function normalizeDigits(value: string) {
  return value.normalize('NFKC').replace(/[०-९൦-൯]/g, digit =>
    String(digit.charCodeAt(0) - (digit >= '൦' ? '൦' : '०').charCodeAt(0)))
}

export function readPaise(input: string) {
  const value = normalizeDigits(input.trim())
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, cents = ''] = value.replaceAll(',', '').split('.')
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, '0'))
  return validAmount(amount) ? amount : null
}

function validAmount(amount: number) {
  return Number.isSafeInteger(amount) && amount > 0 && amount <= maxPaise
}

export function localDate(date = new Date()) {
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-')
}

export function validDate(date: string, today = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || date < '1900-01-01') return false
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function currentAgreement(ledger: Ledger, employerId: string) {
  for (let index = ledger.agreements.length - 1; index >= 0; index--) {
    const agreement = ledger.agreements[index]
    if (agreement.employerId === employerId) return agreement
  }
}

export function workOn(ledger: Ledger, employerId: string, date: string) {
  return ledger.work.find(entry => entry.employerId === employerId && entry.date === date)
}

export function totals(ledger: Ledger, employerId: string) {
  let days = 0
  let earned = 0
  let paid = 0
  for (const entry of ledger.work) {
    if (entry.employerId !== employerId) continue
    days += entry.days
    earned += entry.rate * entry.days
  }
  for (const entry of ledger.payments) {
    if (entry.employerId === employerId) paid += entry.amount
  }
  return { days, earned, paid, balance: earned - paid }
}

export function validateProposal(ledger: Ledger, proposal: Proposal, today = localDate()) {
  if (proposal.kind === 'employer') {
    if (!proposal.name.trim() || proposal.name.trim().length > 80 ||
        proposal.description.length > 160 || !validAmount(proposal.rate)) throw new LedgerError('invalid')
    return
  }
  if (!ledger.employers.some(employer => employer.id === proposal.employerId)) throw new LedgerError('chooseEmployer')
  const agreement = currentAgreement(ledger, proposal.employerId)
  if (proposal.kind === 'wage') {
    if (!validAmount(proposal.rate)) throw new LedgerError('invalid')
    if (agreement?.id !== proposal.agreementId) throw new LedgerError('changed')
    return
  }
  if (!validDate(proposal.date, today)) throw new LedgerError('invalid')
  if (proposal.kind === 'payment') {
    if (!validAmount(proposal.amount)) throw new LedgerError('invalid')
    return
  }
  if (!Number.isInteger(proposal.days) || proposal.days < 1 || proposal.days > 366) throw new LedgerError('invalid')
  const existing = workOn(ledger, proposal.employerId, proposal.date)
  if (existing && !proposal.replaces) throw new LedgerError('duplicateWork')
  if (existing?.id !== proposal.replaces) throw new LedgerError('changed')
  if (existing ? existing.rate !== proposal.rate :
    agreement?.id !== proposal.agreementId || agreement.rate !== proposal.rate) throw new LedgerError('changed')
}

/** Called by storage only after the user explicitly confirms the exact proposal ID. */
export function applyConfirmed(ledger: Ledger, proposal: Proposal, confirmationId: string, now = new Date()): Ledger {
  if (confirmationId !== proposal.id) throw new LedgerError('invalid')
  // Retries with the same confirmation can never add a payment or work entry twice.
  if ([...ledger.employers, ...ledger.agreements, ...ledger.work, ...ledger.payments].some(entry => entry.id === proposal.id)) return ledger
  validateProposal(ledger, proposal, localDate(now))
  const createdAt = now.toISOString()
  const { id } = proposal
  if (proposal.kind === 'employer') {
    const employer = { id, name: proposal.name.trim(), description: proposal.description.trim(), createdAt }
    const agreement = { id, employerId: id, rate: proposal.rate, createdAt }
    return { ...ledger, employers: [...ledger.employers, employer], agreements: [...ledger.agreements, agreement], activeId: id }
  }
  const { employerId } = proposal
  const next = { ...ledger }
  if (proposal.kind === 'wage') {
    next.agreements = [...ledger.agreements, { id, employerId, rate: proposal.rate, createdAt }]
  } else if (proposal.kind === 'work') {
    const { date, days, rate, replaces } = proposal
    next.work = [...ledger.work.filter(entry => entry.id !== replaces), { id, employerId, date, days, rate, createdAt }]
  } else {
    const { date, amount } = proposal
    next.payments = [...ledger.payments, { id, employerId, date, amount, createdAt }]
  }
  // Keep persisted aggregates within exact integer range.
  const { earned, paid } = totals(next, employerId)
  if (!Number.isSafeInteger(earned) || !Number.isSafeInteger(paid)) throw new LedgerError('overflow')
  return next
}
