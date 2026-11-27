import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { createLedgerStore } from '../services/storage'
import { LedgerError, localDate, totals } from '../domain/ledger'
import type { Proposal } from '../domain/ledger'

it('persists confirmed records, leaves unconfirmed records untouched, and serializes duplicate submissions', async () => {
  const store = createLedgerStore('integration-ledger')
  const employer: Proposal = { kind: 'employer', id: 'site', name: 'Worksite', description: '', rate: 70_000 }
  const work: Proposal = { kind: 'work', id: 'work', employerId: employer.id, agreementId: employer.id,
    date: localDate(), days: 6, rate: 70_000 }
  const payment: Proposal = { kind: 'payment', id: 'payment', employerId: employer.id, date: localDate(), amount: 200_000 }
  await expect(store.confirm(employer, 'not-confirmed')).rejects.toThrowError(new LedgerError('invalid'))
  expect((await store.read()).employers).toEqual([])
  await store.confirm(employer, employer.id)
  const secondTab = createLedgerStore('integration-ledger')
  const results = await Promise.allSettled([store.confirm(work, work.id), secondTab.confirm({ ...work, id: 'duplicate' }, 'duplicate')])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: new LedgerError('duplicateWork') })
  await store.confirm(payment, payment.id)
  const reloaded = await createLedgerStore('integration-ledger').read()
  expect(reloaded.activeId).toBe(employer.id)
  expect(reloaded.work).toHaveLength(1)
  expect(totals(reloaded, employer.id).balance).toBe(220_000)
})
