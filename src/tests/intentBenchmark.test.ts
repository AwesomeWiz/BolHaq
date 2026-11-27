import { expect, it } from 'vitest'
import { intentParser } from '../domain/intent'
import { interpretIntent } from '../domain/interpretIntent'
import { evaluation } from './fixtures/intentEvaluation'
import type { ExpectedIntent, Status } from './fixtures/intentEvaluation'

const today = '2026-11-27'
const context = { today, activeWorksiteId: 'abc', worksites: [
  { id: 'abc', name: 'ABC Construction' }, { id: 'metro', name: 'Metro Works' },
] }
const writes = new Set(['RECORD_PAYMENT', 'RECORD_WORK', 'SET_DAILY_WAGE', 'CREATE_WORKSITE'])
const baseline = process.env.BOLHAQ_BENCHMARK_BASELINE === '1'

function classify(transcript: string): { intent: ExpectedIntent; status: Status } {
  if (baseline) {
    const parsed = intentParser.parse(transcript, today)
    const status = parsed.intent === 'UNKNOWN' ? 'unsupported' :
      parsed.ambiguity ? 'ambiguous' : parsed.missing.length ? 'missing' : 'understood'
    switch (parsed.intent) {
      case 'CREATE_EMPLOYER': return { intent: 'CREATE_WORKSITE', status }
      case 'QUERY_BALANCE': return { intent: 'QUERY_WORKSITE_BALANCE', status }
      case 'OPEN_REPORT': {
        const { view } = parsed.parameters
        return { intent: view === 'overview' ? 'QUERY_TOTAL_BALANCE' :
          view === 'statement' ? 'GENERATE_WAGE_REPORT' : 'PREPARE_PAYMENT_REMINDER', status }
      }
      default: return { intent: parsed.intent, status }
    }
  }
  const { intent, status } = interpretIntent(transcript, context)
  return { intent, status }
}

it('evaluates the fixed multilingual held-out corpus', () => {
  const rows = Object.entries(evaluation).flatMap(([locale, all]) =>
    all.map((entry: readonly [string, ExpectedIntent, Status?]) => {
      const [transcript, intent, status = intent === 'UNKNOWN' ? 'unsupported' : 'understood'] = entry
      return { locale, transcript, intent, status }
    }))
  const results = rows.map(row => ({ ...row, actual: classify(row.transcript) }))
  const elapsedStart = performance.now()
  for (let pass = 0; pass < 50; pass++) {
    for (const row of rows) classify(row.transcript)
  }
  const micros = Math.round((performance.now() - elapsedStart) * 1000 / (rows.length * 50))
  function measure(group: typeof results) {
    const supported = group.filter(row => row.intent !== 'UNKNOWN' && row.status === 'understood')
    return {
      count: group.length,
      correct: group.filter(row => row.intent === row.actual.intent).length,
      incorrect: group.filter(row => row.intent !== row.actual.intent).length,
      unknown: group.filter(row => row.actual.intent === 'UNKNOWN').length,
      clarification: group.filter(row => row.actual.status === 'ambiguous' || row.actual.status === 'missing').length,
      supported: supported.length,
      supportedCorrect: supported.filter(row => row.intent === row.actual.intent && row.actual.status === 'understood').length,
    }
  }
  const byLanguage = Object.fromEntries(Object.keys(evaluation).map(locale =>
    [locale, measure(results.filter(row => row.locale === locale))]))
  const byIntent = Object.fromEntries([...new Set(rows.map(row => row.intent))].map(intent =>
    [intent, measure(results.filter(row => row.intent === intent))]))
  const unsafe = results.filter(row =>
    writes.has(row.actual.intent) && row.actual.status === 'understood' &&
    (row.actual.intent !== row.intent || row.status !== 'understood'))
  const overall = measure(results)
  const summary = { engine: baseline ? 'TASK-002B compatibility rules' : 'TASK-002C', overall, byLanguage, byIntent, unsafe, meanMicroseconds: micros }
  console.info(JSON.stringify(summary, null, 2))
  const misses = results.filter(row =>
    (row.intent !== 'UNKNOWN' && row.status === 'understood' && row.actual.status !== 'understood') ||
    row.actual.intent !== row.intent)
  if (process.env.BOLHAQ_BENCHMARK_DEBUG === '1') console.info(JSON.stringify(misses, null, 2))
  expect(rows).toHaveLength(90)
  expect(unsafe).toEqual([])
  if (!baseline) expect(overall.supportedCorrect / overall.supported).toBeGreaterThanOrEqual(0.9)
})

it.each([
  ['I received Rs 300.', 'RECORD_PAYMENT'],
  ['How much am I old across all worksites?', 'QUERY_TOTAL_BALANCE'],
  ['मुझे आईएस 2000 मिले।', 'RECORD_PAYMENT'],
  ['Show the balance for Metro Works.', 'QUERY_WORKSITE_BALANCE'],
  ['എന്\u200dറെ ആകെ ബാക്കി കൂലി എത്ര?', 'QUERY_TOTAL_BALANCE'],
  ['എനിക്ക് ആകെ എത്ര കൂലി കിട്ടാനുണ്ടു്?', 'QUERY_TOTAL_BALANCE'],
] as const)('keeps the transcript-variant check separate from the held-out score for %s', (transcript, expected) => {
  expect(interpretIntent(transcript, context)).toMatchObject({ intent: expected, status: 'understood', original: transcript })
})
