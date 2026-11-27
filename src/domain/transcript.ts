import { localDate, normalizeDigits, validDate } from './ledger'

export function normalizeTranscript(transcript: string) {
  return normalizeDigits(transcript)
    .replace(/[‘’]/gu, "'")
    .trim().replace(/\s+/gu, ' ').replace(/[.!?。।॥…]+$/u, '').trim()
}

export function shiftDate(today: string, days: number) {
  const date = new Date(today + 'T12:00:00')
  date.setDate(date.getDate() + days)
  return localDate(date)
}

const temporalToken = /(?<![\p{L}\p{M}\d])(?:yesterday|today|कल|आज(?: का| की)?|ഇന്നലെ|ഇന്ന്|ഇന്നത്തെ|(?:on )?\d{4}-\d{2}-\d{2}(?: को|-ന്)?)(?![\p{L}\p{M}\d])/giu
const unclearDate = /(?<![\p{L}\p{M}\d])(?:on (?:last )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:on )?\d{1,2}\/\d{1,2}\/\d{2,4})(?![\p{L}\p{M}\d/])/iu

// Apply only after detecting a completed statement or a deliberate work-log request.
// Hindi कल therefore denotes yesterday and never authorizes a future payment.
export function datedText(text: string, today: string) {
  const dates = new Set<string>()
  const rest = text.replace(temporalToken, token => {
    dates.add(token.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
      (/^(?:yesterday|कल|ഇന്നലെ)$/iu.test(token) ? shiftDate(today, -1) : today))
    return ' '
  }).trim().replace(/^, *|, *$/g, '').replace(/ +/g, ' ')
  const first = [...dates][0]
  if (unclearDate.test(rest)) return { text: rest.replace(unclearDate, '').trim(), date: null }
  return { text: rest, date: dates.size > 1 || first && !validDate(first, today) ? null : first }
}
