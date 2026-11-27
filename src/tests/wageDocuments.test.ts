import { expect, it } from 'vitest'
import { paymentReminder, statementText } from '../features/wageDocuments'
import { wageStatement } from '../domain/reports'
import { reportLedger } from './fixtures/reportLedger'

const november = { from: '2026-11-01', to: '2026-11-30' }
const unsettled = () => {
  const ledger = reportLedger()
  ledger.payments = ledger.payments.filter(entry => entry.id !== 'a-settled')
  return ledger
}

it.each([
  ['en-IN', 'Please let me know', 'Current outstanding wages'],
  ['hi-IN', 'कृपया बताइए', 'अभी की बकाया मज़दूरी'],
  ['ml-IN', 'ദയവായി അറിയിക്കാമോ', 'ഇപ്പോൾ കിട്ടാനുള്ള കൂലി'],
] as const)('builds a localized reminder with only the relevant worksite and correct amounts in %s', (locale, polite, due) => {
  const draft = paymentReminder(unsettled(), 'a', locale, november)
  for (const value of ['ABC Construction', '₹3,100', '₹2,000', due, '₹2,500', polite]) expect(draft).toContain(value)
  expect(draft).not.toContain('कलूर Site')
})

it('uses current balance when later payments have settled an older period and blocks advances', () => {
  expect(paymentReminder(reportLedger(), 'a', 'en-IN', november)).toBe('')
  expect(paymentReminder(reportLedger(), 'b', 'hi-IN')).toBe('')
})

it('includes historical rates, as-of balance, generation date and a worker-data disclaimer in shared statements', () => {
  const report = wageStatement(reportLedger(), 'a', november)!
  const text = statementText(report, 'en-IN', '2026-12-02')
  for (const value of ['1 × ₹700', '3 × ₹800', 'Generated 2 Dec 2026', 'Outstanding wages · ₹2,500', 'The employer has not verified']) {
    expect(text).toContain(value)
  }
})
