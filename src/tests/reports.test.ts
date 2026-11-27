import { expect, it } from 'vitest'
import { intentParser } from '../domain/intent'
import { matchWorksite, monthRange, resolvePeriod, wageStatement, worksiteOverview } from '../domain/reports'
import { money } from '../locales'
import { reportLedger } from './fixtures/reportLedger'

const range = { from: '2026-11-01', to: '2026-11-30' }

it('reports the period activity and carried balance independently using historical wage snapshots', () => {
  const statement = wageStatement(reportLedger(), 'a', range)!
  expect(statement.period).toEqual({ days: 4, earned: 310_000, paid: 200_000, balance: 110_000 })
  expect(statement.balance).toBe(250_000)
  expect(statement.records.map(entry => entry.id)).toEqual(['a-nov1', 'a-nov2', 'a-paid'])
  expect(statement.records.filter(entry => entry.kind === 'work').map(entry => entry.rate)).toEqual([70_000, 80_000])
})

it('supports an empty period, prior work with no payments, fully settled, and advance balances', () => {
  const ledger = reportLedger()
  expect(wageStatement(ledger, 'a', { from: '2026-11-04', to: '2026-11-14' })).toMatchObject({
    records: [], period: { days: 0, earned: 0, paid: 0, balance: 0 }, balance: 450_000,
  })
  expect(wageStatement(ledger, 'a', { from: '2026-10-01', to: '2026-10-31' })?.period.paid).toBe(0)
  expect(wageStatement(ledger, 'a', { from: '2026-12-01', to: '2026-12-31' })?.balance).toBe(0)
  expect(wageStatement(ledger, 'b', range)?.balance).toBe(-50_000)
  expect(wageStatement(ledger, 'missing', range)).toBeNull()
})

it('keeps advances separate from positive balances while filtering earnings and payments by period', () => {
  const ledger = reportLedger()
  ledger.payments = ledger.payments.filter(entry => entry.id !== 'a-settled')
  expect(worksiteOverview(ledger, range)).toMatchObject({
    owed: 250_000n, advances: 50_000n, earned: 410_000n, paid: 350_000n,
    sites: [{ balance: 250_000, earned: 310_000 }, { balance: -50_000, earned: 100_000 }],
  })
  expect(money(9_007_199_254_740_993n, 'en-IN')).toBe('₹9,00,71,99,25,47,409.93')
})

it('validates date ranges and resolves February or the current partial month', () => {
  expect(monthRange('2024-02', '2026-11-27')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  expect(monthRange('2026-11', '2026-11-27')).toEqual({ from: '2026-11-01', to: '2026-11-27' })
  expect(monthRange('2026-12', '2026-11-27')).toBeNull()
  expect(resolvePeriod({ kind: 'range', from: '2026-11-05', to: '2026-11-04' }, '2026-11-27')).toBeNull()
  expect(resolvePeriod({ kind: 'range', from: '2026-11-31', to: '2026-12-20' }, '2026-12-27')).toBeNull()
})

it('matches a named worksite only when its normalized name is unique', () => {
  const ledger = reportLedger()
  expect(matchWorksite(ledger, ' abc   CONSTRUCTION ')?.id).toBe('a')
  ledger.employers.push({ ...ledger.employers[0], id: 'duplicate' })
  expect(matchWorksite(ledger, 'ABC Construction')).toBeUndefined()
})

it.each([
  ['Show my wage statement for this month.', { view: 'statement', month: '2026-03' }],
  ['Make a report for ABC Construction.', { view: 'statement', worksiteName: 'ABC Construction' }],
  ['Show my earnings for November.', { view: 'statement', month: '2025-11' }],
  ['इस महीने का हिसाब दिखाओ।', { view: 'statement' }],
  ['मेरी मजदूरी की रिपोर्ट दिखाओ।', { view: 'statement' }],
  ['ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ.', { view: 'statement' }],
  ['എന്റെ ശമ്പളത്തിന്റെ കണക്ക് കാണിക്കൂ.', { view: 'statement' }],
  ['Prepare a payment reminder.', { view: 'reminder' }],
  ['Prepare a payment reminder for ABC Construction.', { view: 'reminder', worksiteName: 'ABC Construction' }],
  ['Ask ABC Construction for my remaining wages.', { view: 'reminder', worksiteName: 'ABC Construction' }],
  ['बाकी मजदूरी के लिए संदेश बनाओ।', { view: 'reminder' }],
  ['ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ.', { view: 'reminder' }],
  ['How much am I owed across all worksites?', { view: 'overview' }],
  ['Show my total outstanding wages.', { view: 'overview' }],
  ['How much did I earn this month?', { view: 'overview', month: '2026-03' }],
  ['मुझे कुल कितने पैसे मिलने बाकी हैं?', { view: 'overview' }],
  ['सभी काम की जगहों का हिसाब दिखाओ।', { view: 'overview' }],
  ['എനിക്ക് ആകെ എത്ര കൂലി കിട്ടാനുണ്ട്?', { view: 'overview' }],
  ['എല്ലാ ജോലിസ്ഥലങ്ങളിലെയും കണക്ക് കാണിക്കൂ.', { view: 'overview' }],
])('recognizes the read-only report command %s', (transcript, parameters) => {
  expect(intentParser.parse(transcript, '2026-03-20')).toMatchObject({
    intent: 'OPEN_REPORT', parameters, transcript, missing: [], requiresConfirmation: false,
  })
})
