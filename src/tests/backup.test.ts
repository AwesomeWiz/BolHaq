import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { BackupError, backupSizeLimit, exportBackup, readBackup } from '../domain/backup'
import { currentAgreement, emptyLedger, totals } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'
import { createLedgerStore } from '../services/storage'
import { reportLedger } from './fixtures/reportLedger'

const now = new Date(2026, 11, 12, 12)
const serialized = (ledger = reportLedger()) => exportBackup(ledger, now).content

it('exports the complete versioned ledger and uses the local export date for the filename', () => {
  const ledger = reportLedger()
  const { content, filename } = exportBackup(ledger, now)
  expect(filename).toBe('BolHaq-Backup-2026-12-12.json')
  const backup = readBackup(content)
  expect(backup).toEqual({ appId: 'bolhaq', version: 1, exportedAt: now.toISOString(), ledger })
  expect(backup.ledger.employers).toHaveLength(2)
  expect(currentAgreement(backup.ledger, 'a')?.rate).toBe(80_000)
  expect(backup.ledger.work.find(entry => entry.id === 'a-old')?.rate).toBe(70_000)
})

it('allows an empty ledger and chooses a valid site when no active site was saved', () => {
  expect(readBackup(serialized(emptyLedger())).ledger).toEqual(emptyLedger())
  expect(readBackup(serialized({ ...reportLedger(), activeId: null })).ledger.activeId).toBe('a')
})

it('rejects malformed JSON, an unknown format, and oversized data', () => {
  expect(() => readBackup('oops')).toThrowError(new BackupError('badBackup'))
  const backup = JSON.parse(serialized())
  expect(() => readBackup(JSON.stringify({ ...backup, appId: 'other' }))).toThrowError(new BackupError('badBackup'))
  expect(() => readBackup(JSON.stringify({ ...backup, version: 2 }))).toThrowError(new BackupError('backupVersion'))
  expect(() => readBackup(' '.repeat(backupSizeLimit + 1))).toThrowError(new BackupError('backupLarge'))
})

const mutations: Array<[string, (ledger: Ledger) => void]> = [
  ['invalid money', data => { data.payments[0].amount = 0.25 }],
  ['unsupported monetary magnitude', data => { data.agreements[0].rate = Number.MAX_SAFE_INTEGER }],
  ['missing employer relationship', data => { data.payments[0].employerId = 'missing' }],
  ['missing agreement', data => { data.agreements = data.agreements.filter(entry => entry.employerId !== 'b') }],
  ['invalid active employer', data => { data.activeId = 'missing' }],
  ['duplicate identifier', data => { data.work[0].id = data.payments[0].id }],
  ['duplicate work date for one site', data => { data.work[0].date = data.work[1].date }],
  ['unknown historical rate', data => { data.work[0].rate = 22_300 }],
  ['invalid calendar date', data => { data.payments[0].date = '2026-11-31' }],
  ['invalid timestamp', data => { data.work[0].createdAt = '2026-01' }],
  ['unexpected fields', data => { Object.assign(data.work[0], { kind: 'payment', amount: 10 }) }],
]
it.each(mutations)('rejects %s even if the rest of the file is valid', (_label, mutate) => {
  const ledger = reportLedger()
  mutate(ledger)
  expect(() => readBackup(serialized(ledger))).toThrowError(new BackupError('badBackup'))
})

it('replaces atomically, survives a fresh connection, and preserves balances and switching', async () => {
  const store = createLedgerStore('restore-happy')
  const old = { kind: 'employer', id: 'old', name: 'Old Site', description: '', rate: 100 } as const
  await store.confirm(old, old.id)
  const restored = await store.restore(serialized())
  expect(restored.employers.map(site => site.id)).toEqual(['a', 'b'])
  expect((await createLedgerStore('restore-happy').read()).activeId).toBe('b')
  expect(totals(restored, 'a').balance).toBe(0)
  expect(totals(restored, 'b').balance).toBe(-50_000)
  expect((await store.select('a')).activeId).toBe('a')
})

it('preserves existing records for invalid input and for a write that aborts', async () => {
  const store = createLedgerStore('restore-rollback')
  const old = { kind: 'employer', id: 'old', name: 'Old Site', description: '', rate: 100 } as const
  const before = await store.confirm(old, old.id)
  await expect(store.restore('{broken')).rejects.toThrow()
  expect(await store.read()).toEqual(before)
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore) {
    this.transaction.abort()
    throw new DOMException('Aborted offline storage write', 'AbortError')
  })
  await expect(store.restore(serialized())).rejects.toThrow()
  expect(await createLedgerStore('restore-rollback').read()).toEqual(before)
})
afterEach(() => vi.restoreAllMocks())
