import { expect, it } from 'vitest'
import { interpretIntent } from '../domain/interpretIntent'
import { normalizeTranscript } from '../domain/transcript'

const today = '2026-11-27'
const context = { today, activeWorksiteId: 'abc', worksites: [
  { id: 'abc', name: 'ABC Construction' }, { id: 'metro', name: 'Metro Works' },
] }
const yesterday = '2026-11-26'

it('normalizes Unicode, punctuation and digits while returning the original transcript', () => {
  const text = '  I   got　₹൨,൦൦൦   yesterday。 '
  expect(normalizeTranscript(text)).toBe('I got ₹2,000 yesterday')
  expect(interpretIntent(text, context)).toMatchObject({
    original: text, intent: 'RECORD_PAYMENT', parameters: { amount: 200_000, date: yesterday },
    status: 'understood', requiresConfirmation: true,
  })
})

it.each([
  ['I received 2000 rupees.', 200_000, undefined, 'abc'],
  ['My contractor gave me two thousand yesterday.', 200_000, yesterday, 'abc'],
  ['They paid me two thousand for my work.', 200_000, undefined, 'abc'],
  ['I got 2000 yesterday.', 200_000, yesterday, 'abc'],
  ['Yesterday, I received 700 rupees.', 70_000, yesterday, 'abc'],
  ['ABC Construction paid me 1500.', 150_000, undefined, 'abc'],
  ['Metro Works paid me 1500 on 2026-11-23.', 150_000, '2026-11-23', 'metro'],
  ['I got 2000 rupaye.', 200_000, undefined, 'abc'],
  ['मुझे कल दो हजार रुपये मिले।', 200_000, yesterday, 'abc'],
  ['कल ठेकेदार से सात सौ रुपये मिले।', 70_000, yesterday, 'abc'],
  ['मुझे 2000 rupees मिले।', 200_000, undefined, 'abc'],
  ['मुझे आईएस 2000 मिले।', 200_000, undefined, 'abc'],
  ['ഇന്നലെ എനിക്ക് രണ്ടായിരം രൂപ കിട്ടി.', 200_000, yesterday, 'abc'],
  ['ഇന്നലെ എനിക്ക് എഴുന്നൂറ് രൂപ കിട്ടി.', 70_000, yesterday, 'abc'],
  ['എനിക്ക് 2000 rupees കിട്ടി.', 200_000, undefined, 'abc'],
] as const)('extracts exact money and date from %s', (text, amount, date, worksiteId) => {
  const result = interpretIntent(text, context)
  expect(result).toMatchObject({ intent: 'RECORD_PAYMENT', status: 'understood', parameters: { amount }, worksiteId })
  expect(result.intent === 'RECORD_PAYMENT' && result.parameters.date).toBe(date)
})

it.each([
  ['Put down three days of work.', 3, undefined],
  ['आज की हाजिरी लगा दो।', 1, today],
  ['ഇന്നത്തെ ജോലി കണക്കിൽ ചേർക്കൂ.', 1, today],
  ['ഞാൻ ഇന്നലെ ജോലി ചെയ്തു.', 1, yesterday],
] as const)('interprets the workday count and date in %s', (text, days, date) => {
  const result = interpretIntent(text, context)
  expect(result).toMatchObject({ intent: 'RECORD_WORK', status: 'understood', parameters: { days } })
  expect(result.intent === 'RECORD_WORK' && result.parameters.date).toBe(date)
})

it.each([
  'I did not receive 2000 rupees.', "I haven't received my wages.", 'I will receive 2000 tomorrow.',
  'I should receive 2000.', 'My contractor owes me 2000.', 'I paid my contractor 2000.',
  'They promised to pay me tomorrow.', 'Did I receive 2000?', 'I received 2000?',
  'मुझे दो हजार रुपये नहीं मिले।', 'मुझे अभी तक पैसे नहीं मिले।', 'मुझे 2000 रुपये मिलने वाले हैं।',
  'എനിക്ക് രണ്ടായിരം രൂപ കിട്ടിയില്ല.', 'എനിക്ക് ഇനിയും കൂലി കിട്ടിയിട്ടില്ല.', 'നാളെ 2000 രൂപ കിട്ടും.',
])('cannot stage a received-payment write for %s', text => {
  expect(interpretIntent(text, context)).toMatchObject({ intent: 'UNKNOWN', requiresConfirmation: false })
})

it('clarifies missing or conflicting amounts without mining other numbers', () => {
  for (const text of ['My contractor gave me money for two days.', 'They paid me 700 or 900.', 'I got 5 work hours today.']) {
    expect(interpretIntent(text, context)).toMatchObject({
      intent: 'RECORD_PAYMENT', parameters: { amount: null }, status: 'ambiguous', missing: ['amount'],
    })
  }
  expect(interpretIntent('I received some money.', context)).toMatchObject({
    intent: 'RECORD_PAYMENT', parameters: { amount: null }, status: 'missing', missing: ['amount'],
  })
  expect(interpretIntent('I received 700 yesterday on 2026-11-23.', context)).toMatchObject({
    intent: 'RECORD_PAYMENT', parameters: { amount: 70_000, date: null }, status: 'ambiguous', missing: ['date'],
  })
  expect(interpretIntent('They paid me 700 on Friday.', context)).toMatchObject({
    intent: 'RECORD_PAYMENT', parameters: { amount: 70_000, date: null }, status: 'ambiguous', missing: ['date'],
  })
})

it('offers a chooser for an unknown or duplicate worksite and never uses the active site for an explicit reference', () => {
  expect(interpretIntent('Site 7 paid me 1500.', context)).toMatchObject({
    intent: 'RECORD_PAYMENT', parameters: { amount: 150_000 }, reference: 'Site 7', status: 'missing', missing: ['worksite'],
    worksiteId: undefined,
  })
  const duplicate = { ...context, worksites: [...context.worksites, { id: 'second-metro', name: 'metro works' }] }
  expect(interpretIntent('Metro Works paid me 1500.', duplicate)).toMatchObject({
    intent: 'RECORD_PAYMENT', status: 'ambiguous', missing: ['worksite'], issue: 'worksiteAmbiguous', worksiteId: undefined,
  })
})

it.each(['I worked today and received 500.', 'I worked today. I received 500.', 'मैंने आज काम किया और मुझे 500 मिले।',
  'ഞാൻ ഇന്ന് ജോലി ചെയ്തു പിന്നെ എനിക്ക് 500 രൂപ കിട്ടി.'])('asks for one action for %s', text => {
  expect(interpretIntent(text, context)).toMatchObject({
    intent: 'UNKNOWN', issue: 'oneAction', status: 'ambiguous', requiresConfirmation: false,
  })
})

it('distinguishes read-only scopes, financial confirmation, and unsupported requests', () => {
  expect(interpretIntent('How much is pending?', context)).toMatchObject({ intent: 'QUERY_WORKSITE_BALANCE', worksiteId: 'abc' })
  expect(interpretIntent('How much is pending for Total Construction?', {
    ...context, worksites: [...context.worksites, { id: 'total', name: 'Total Construction' }],
  })).toMatchObject({ intent: 'QUERY_WORKSITE_BALANCE', worksiteId: 'total' })
  expect(interpretIntent('Show my overall outstanding wages.', context)).toMatchObject({ intent: 'QUERY_TOTAL_BALANCE' })
  expect(interpretIntent('Show my earnings for November.', context)).toMatchObject({
    intent: 'GENERATE_WAGE_REPORT', parameters: { month: '2026-11' },
  })
  expect(interpretIntent('Pull up last month’s wage report for Metro Works.', context)).toMatchObject({
    intent: 'GENERATE_WAGE_REPORT', parameters: { month: '2026-10' }, worksiteId: 'metro',
  })
  expect(interpretIntent('Make a message asking for my wages.', context)).toMatchObject({ intent: 'PREPARE_PAYMENT_REMINDER' })
  expect(interpretIntent('Switch to Metro Works.', context)).toMatchObject({
    intent: 'SELECT_WORKSITE', worksiteId: 'metro', requiresConfirmation: true,
  })
  expect(interpretIntent('Book a train ticket.', context)).toMatchObject({ intent: 'UNKNOWN', status: 'unsupported' })
})
