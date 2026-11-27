import { applyConfirmed, emptyLedger } from '../../domain/ledger'
import type { Proposal } from '../../domain/ledger'

export function reportLedger() {
  let ledger = emptyLedger()
  function apply(proposal: Proposal, stamp: string) {
    ledger = applyConfirmed(ledger, proposal, proposal.id, new Date(stamp + 'T12:00:00'))
  }
  apply({ kind: 'employer', id: 'a', name: 'ABC Construction', description: '', rate: 70_000 }, '2026-10-01')
  apply({ kind: 'work', id: 'a-old', employerId: 'a', agreementId: 'a', date: '2026-10-30', days: 2, rate: 70_000 }, '2026-10-30')
  apply({ kind: 'work', id: 'a-nov1', employerId: 'a', agreementId: 'a', date: '2026-11-01', days: 1, rate: 70_000 }, '2026-11-01')
  apply({ kind: 'wage', id: 'a-rate', employerId: 'a', agreementId: 'a', rate: 80_000 }, '2026-11-02')
  apply({ kind: 'work', id: 'a-nov2', employerId: 'a', agreementId: 'a-rate', date: '2026-11-03', days: 3, rate: 80_000 }, '2026-11-03')
  apply({ kind: 'payment', id: 'a-paid', employerId: 'a', date: '2026-11-15', amount: 200_000 }, '2026-11-15')
  apply({ kind: 'payment', id: 'a-settled', employerId: 'a', date: '2026-12-01', amount: 250_000 }, '2026-12-01')
  apply({ kind: 'employer', id: 'b', name: 'कलूर Site', description: 'Station', rate: 50_000 }, '2026-10-01')
  apply({ kind: 'work', id: 'b-nov', employerId: 'b', agreementId: 'b', date: '2026-11-01', days: 2, rate: 50_000 }, '2026-11-01')
  apply({ kind: 'payment', id: 'b-advance', employerId: 'b', date: '2026-11-15', amount: 150_000 }, '2026-11-15')
  return ledger
}
