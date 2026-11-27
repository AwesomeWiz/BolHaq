import { describe, expect, it } from 'vitest'
import { applyConfirmed, emptyLedger, LedgerError, localDate, readPaise, totals } from '../domain/ledger'
import type { Ledger, Proposal } from '../domain/ledger'
import { money } from '../locales'

export const now = new Date(2026, 10, 27, 12)
export const date = localDate(now)
export const employer: Proposal = { id: 'site-a', kind: 'employer', name: 'ABC Construction', description: '', rate: 70_000 }
export const work: Proposal = { id: 'work-a', kind: 'work', employerId: 'site-a', date, days: 6, rate: 70_000, agreementId: 'site-a' }
export const payment: Proposal = { id: 'payment-a', kind: 'payment', employerId: 'site-a', date, amount: 200_000 }
const change: Proposal = { id: 'new-rate', kind: 'wage', employerId: 'site-a', rate: 80_000, agreementId: 'site-a' }
const confirm = (ledger: Ledger, proposal: Proposal) => applyConfirmed(ledger, proposal, proposal.id, now)
const initial = () => confirm(emptyLedger(), employer)

describe('confirmed ledger', () => {
  it('computes exact wages and partial payments', () => {
    expect(totals(confirm(confirm(initial(), work), payment), employer.id)).toEqual({
      days: 6, earned: 420_000, paid: 200_000, balance: 220_000,
    })
    expect(totals(confirm(initial(), payment), employer.id).balance).toBe(-200_000)
    expect(money(-50, 'en-IN')).toBe('-₹0.50')
    expect(money(Number.MAX_SAFE_INTEGER, 'en-IN')).toBe('₹9,00,71,99,25,47,409.91')
  })
  it('keeps separate work and payments for different worksites', () => {
    const second = { ...employer, id: 'site-b', name: 'Second site' }
    const first = confirm(confirm(initial(), work), payment)
    const both = confirm(confirm(first, second), { ...work, id: 'work-b', employerId: second.id, agreementId: second.id, days: 1 })
    expect(both.activeId).toBe(second.id)
    expect(totals(both, employer.id)).toEqual(totals(first, employer.id))
    expect(totals(both, second.id)).toEqual({ days: 1, earned: 70_000, paid: 0, balance: 70_000 })
  })
  it('rejects a duplicate and corrects only an explicitly selected entry at its original rate', () => {
    const ledger = confirm(confirm(initial(), work), change)
    const duplicate = { ...work, id: 'replacement', days: 3 }
    expect(() => confirm(ledger, duplicate)).toThrowError(new LedgerError('duplicateWork'))
    expect(() => confirm(ledger, { ...duplicate, replaces: work.id, rate: 80_000 })).toThrowError(new LedgerError('changed'))
    const corrected = confirm(ledger, { ...duplicate, replaces: work.id })
    expect(corrected.work).toHaveLength(1)
    expect(totals(corrected, employer.id).earned).toBe(210_000)
  })
  it('keeps historical earnings and rejects a stale proposal after a rate change', () => {
    const original = confirm(initial(), work)
    const updated = confirm(original, change)
    const pastDate = { ...work, id: 'second-work', date: '2026-11-26', days: 2 }
    expect(() => confirm(updated, pastDate)).toThrowError(new LedgerError('changed'))
    const next = confirm(updated, { ...pastDate, rate: 80_000, agreementId: change.id })
    expect(next.work.map(entry => entry.rate)).toEqual([70_000, 80_000])
    expect(totals(next, employer.id).earned).toBe(580_000)
  })
  it('requires matching confirmation for every write and handles retried confirmation', () => {
    const ledger = initial()
    for (const proposal of [employer, work, payment, change]) {
      expect(() => applyConfirmed(ledger, proposal, 'wrong', now)).toThrowError(new LedgerError('invalid'))
    }
    expect(ledger.work).toHaveLength(0)
    const saved = confirm(ledger, payment)
    expect(confirm(saved, payment)).toBe(saved)
  })
  it('validates amounts, work counts and dates at the mutation boundary', () => {
    const ledger = initial()
    for (const proposal of [{ ...payment, amount: 0 }, { ...payment, amount: 0.25 },
      { ...change, rate: -1 }, { ...work, days: 1.5 }, { ...work, date: '2026-12-01' }]) {
      expect(() => confirm(ledger, proposal)).toThrowError(new LedgerError('invalid'))
    }
  })
})

it.each(['', '0', '-10', '12.003', '1e3', '99999999999999999', '3,5', '5 and 6'])('rejects invalid amount %s', input => {
  expect(readPaise(input)).toBeNull()
})
it('accepts valid decimals and Indian digit grouping', () => {
  expect(readPaise(' १,००,०००.०५ ')).toBe(10_000_005)
  expect(readPaise('0.10')).toBe(10)
})
