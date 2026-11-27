import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import { readBackup } from '../domain/backup'
import { applyConfirmed, emptyLedger, LedgerError } from '../domain/ledger'
import type { Ledger, Proposal } from '../domain/ledger'

interface Schema extends DBSchema {
  ledger: { key: 'current'; value: Ledger }
}

// One read/write transaction keeps validation and persistence atomic across tabs.
export function createLedgerStore(name = 'bolhaq') {
  let connection: Promise<IDBPDatabase<Schema>> | undefined
  function db() {
    connection ??= openDB<Schema>(name, 1, {
      upgrade(database) { database.createObjectStore('ledger') },
      blocking() {
        void connection?.then(database => database.close())
        connection = undefined
      },
    }).catch(error => {
      connection = undefined
      throw error
    })
    return connection
  }
  async function update(change: (ledger: Ledger) => Ledger) {
    const tx = (await db()).transaction('ledger', 'readwrite')
    try {
      const next = change((await tx.store.get('current')) ?? emptyLedger())
      await tx.store.put(next, 'current')
      await tx.done
      return next
    } catch (error) {
      try { tx.abort() } catch { /* Already finished or aborted. */ }
      await tx.done.catch(() => undefined)
      throw error
    }
  }
  return {
    async read() { return (await (await db()).get('ledger', 'current')) ?? emptyLedger() },
    confirm(proposal: Proposal, confirmationId: string) {
      return update(ledger => applyConfirmed(ledger, proposal, confirmationId))
    },
    restore(content: string) {
      return update(() => readBackup(content).ledger)
    },
    select(id: string) {
      return update(ledger => {
        if (!ledger.employers.some(employer => employer.id === id)) throw new LedgerError('chooseEmployer')
        return { ...ledger, activeId: id }
      })
    },
  }
}

export const ledgerStore = createLedgerStore()
