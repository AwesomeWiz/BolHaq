import { describe, expect, it } from 'vitest'
import { intentParser } from '../domain/intent'
import { languages } from '../locales'

const today = '2026-11-27'
const parse = (input: string) => intentParser.parse(input, today)

describe.each(languages)('$code', ({ examples }) => {
  it('recognizes the four core examples and preserves the transcript', () => {
    expect(parse(examples[0])).toMatchObject({ intent: 'RECORD_WORK', transcript: examples[0],
      parameters: { days: 1, date: today }, requiresConfirmation: true, missing: [] })
    expect(parse(examples[1])).toMatchObject({ intent: 'SET_DAILY_WAGE', parameters: { rate: 70_000 },
      requiresConfirmation: true, missing: [] })
    expect(parse(examples[2])).toMatchObject({ intent: 'RECORD_PAYMENT', parameters: { amount: 200_000 },
      requiresConfirmation: true, missing: [] })
    expect(parse(examples[3])).toMatchObject({ intent: 'QUERY_BALANCE', requiresConfirmation: false, missing: [] })
    expect(parse(examples[4])).toMatchObject({ intent: 'CREATE_EMPLOYER', parameters: { rate: 70_000 },
      requiresConfirmation: true, missing: [] })
  })
})

it.each([
  ['I worked six days.', { days: 6, date: today }],
  ['  ഇന്ന് work ചെയ്തു. ', { days: 1, date: today }],
  ['ഞാൻ ആറ് ദിവസം ജോലി ചെയ്തു.', { days: 6, date: today }],
  ['ഞാൻ ഇന്നലെ ജോലി ചെയ്തു.', { days: 1, date: '2026-11-26' }],
  ['मैंने छह दिन काम किया।', { days: 6, date: today }],
  ['I worked on 2026-11-20.', { days: 1, date: '2026-11-20' }],
  ['I worked three days on 2026-11-20.', { days: 3, date: '2026-11-20' }],
])('recognizes dated or counted work in %s', (input, parameters) => {
  expect(parse(input)).toMatchObject({ intent: 'RECORD_WORK', parameters, ambiguity: null })
})

it.each([
  ['Daily wage 700 രൂപ.', 'SET_DAILY_WAGE', { rate: 70_000 }],
  ['मेरी दिहाडी सात सौ रुपये है।', 'SET_DAILY_WAGE', { rate: 70_000 }],
  ['എന്റെ ദിവസക്കൂലി എഴുന്നൂറ് രൂപയാണ്.', 'SET_DAILY_WAGE', { rate: 70_000 }],
  ['എനിക്ക് രണ്ടായിരം രൂപ കിട്ടി.', 'RECORD_PAYMENT', { amount: 200_000 }],
  ['मुझे दो हज़ार रुपये मिले।', 'RECORD_PAYMENT', { amount: 200_000 }],
  ['मुझे २,०००.५० रुपये मिले।', 'RECORD_PAYMENT', { amount: 200_050 }],
  ['എനിക്ക് ൨൦൦൦ രൂപ കിട്ടി.', 'RECORD_PAYMENT', { amount: 200_000 }],
  ['I received two thousand seven hundred and fifty rupees.', 'RECORD_PAYMENT', { amount: 275_000 }],
  ['I received ₹1,23,456.75.', 'RECORD_PAYMENT', { amount: 12_345_675 }],
  ['Add worksite ABC Construction at 700 rupees per day.', 'CREATE_EMPLOYER', { name: 'ABC Construction', rate: 70_000 }],
])('parses money and mixed language in %s', (input, intent, parameters) => {
  expect(parse(input)).toMatchObject({ intent, parameters, ambiguity: null, missing: [], requiresConfirmation: true })
})

it.each([
  'I received 700 or 800 rupees.', 'I received around 700 rupees.', 'I received -100 rupees.',
  'I received 1,2 rupees.', 'I received 2000.999 rupees.', 'I received 700 and 800 rupees.',
])('requires an amount to be corrected for %s', input => {
  expect(parse(input)).toMatchObject({ intent: 'RECORD_PAYMENT', parameters: { amount: null },
    missing: ['amount'], ambiguity: 'number', requiresConfirmation: true })
})

it('requires correction of conflicting or impossible dates', () => {
  expect(parse('I worked today on 2026-11-12.')).toMatchObject({ parameters: { date: null }, missing: ['date'] })
  expect(parse('I worked on 2026-02-30.')).toMatchObject({ parameters: { date: null }, missing: ['date'] })
})
it('does not interpret unrecognized speech or compound requests as a write', () => {
  expect(parse('I did not work today.')).toMatchObject({ intent: 'UNKNOWN', requiresConfirmation: false })
  expect(parse('Show my balance and set my daily wage.')).toMatchObject({ intent: 'UNKNOWN', ambiguity: 'command' })
})
