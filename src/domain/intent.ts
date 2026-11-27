import { localDate, normalizeDigits, readPaise, validDate } from './ledger'

type Action =
  | { intent: 'SET_DAILY_WAGE'; parameters: { rate: number | null } }
  | { intent: 'RECORD_PAYMENT'; parameters: { amount: number | null } }
  | { intent: 'RECORD_WORK'; parameters: { days: number | null; date: string | null } }
  | { intent: 'CREATE_EMPLOYER'; parameters: { name: string; rate: number | null } }
  | { intent: 'QUERY_BALANCE' | 'UNKNOWN'; parameters: Record<string, never> }

type Details = {
  transcript: string
  missing: ('rate' | 'amount' | 'days' | 'date' | 'name')[]
  ambiguity: 'number' | 'command' | 'date' | null
  requiresConfirmation: boolean
}

export type ParsedIntent = Action & Details
export interface VoiceIntentParser {
  parse(transcript: string, today?: string): ParsedIntent
}

const english = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ')
const localNumbers = new Map<string, number>([
  ...'शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह'.split(' ').map((word, index): [string, number] => [word, index]),
  ...'പൂജ്യം ഒന്ന് രണ്ട് മൂന്ന് നാല് അഞ്ച് ആറ് ഏഴ് എട്ട് ഒമ്പത് പത്ത് പതിനൊന്ന് പന്ത്രണ്ട്'.split(' ')
    .map((word, index): [string, number] => [word, index]),
  ['पांच', 5], ['छः', 6], ['ഒന്നു', 1], ['രണ്ടു', 2], ['മൂന്നു', 3],
  ['सौ', 100], ['हज़ार', 1000], ['हजार', 1000],
  ['നൂറ്', 100], ['നൂറു', 100], ['ഇരുനൂറ്', 200], ['മുന്നൂറ്', 300], ['നാനൂറ്', 400],
  ['അഞ്ഞൂറ്', 500], ['അറുനൂറ്', 600], ['എഴുനൂറ്', 700], ['എഴുന്നൂറ്', 700], ['എഴുനൂറു', 700],
  ['എണ്ണൂറ്', 800], ['തൊള്ളായിരം', 900], ['ആയിരം', 1000],
  ['രണ്ടായിരം', 2000], ['രണ്ട് ആയിരം', 2000],
])

function smallEnglish(input: string): number | null {
  const [first, second, extra] = input.split(' ')
  if (extra) return null
  const index = english.indexOf(first)
  if (!second && index >= 0) return index
  const ten = tens.indexOf(first)
  const unit = second ? english.indexOf(second) : 0
  return ten >= 0 && unit >= 0 && unit <= 9 ? (ten + 2) * 10 + unit : null
}

function spokenInteger(input: string): number | null {
  const normalized = input.replace(/(?<=[a-z])-(?=[a-z])/g, ' ')
  const local = localNumbers.get(normalized)
  if (local !== undefined) return local
  const hindi = /^(\S+) (सौ|हज़ार|हजार)$/u.exec(normalized)
  if (hindi) {
    const units = localNumbers.get(hindi[1])
    const scale = localNumbers.get(hindi[2])
    if (units !== undefined && units >= 1 && units <= 12 && scale) return units * scale
  }
  const compound = /^(.+?) (hundred|thousand)(?: (?:and )?(.+))?$/.exec(normalized)
  if (!compound) return smallEnglish(normalized)
  const multiplier = smallEnglish(compound[1])
  const unit = compound[2] === 'hundred' ? 100 : 1000
  const remainder = compound[3] ? spokenInteger(compound[3]) : 0
  return multiplier && remainder !== null && remainder < unit ? multiplier * unit + remainder : null
}

function parseAmount(raw: string) {
  const amount = raw.trim().replace(/^₹\s*/, '')
    .replace(/\s*(?:rupees?|rs\.?|रुपये|रुपए|रुपया|रुपएँ|रुपएं|रुपयों|रुपे|രൂപ)(?:യാണ്|ആണ്)?$/u, '').trim()
  const spelled = spokenInteger(amount)
  return readPaise(amount) ?? (spelled === null ? null : readPaise(String(spelled)))
}

function previousDate(today: string) {
  const date = new Date(today + 'T12:00:00')
  date.setDate(date.getDate() - 1)
  return localDate(date)
}

export const intentParser: VoiceIntentParser = {
  parse(transcript, today = localDate()) {
    const original = normalizeDigits(transcript).trim().replace(/\s+/g, ' ').replace(/[.!?।…]+$/u, '').trim()
    const command = original.toLowerCase()
    function result(action: Action, missing: Details['missing'] = [], ambiguity: Details['ambiguity'] = null): ParsedIntent {
      return { ...action, transcript, missing, ambiguity,
        requiresConfirmation: action.intent !== 'QUERY_BALANCE' && action.intent !== 'UNKNOWN' }
    }
    if (/^(?:how much (?:money )?(?:am i owed|is outstanding|do i have left)|(?:check|show(?: me)?) (?:my )?(?:outstanding wages|balance)|എനിക്ക് (?:ഇനി )?എത്ര (?:രൂപ )?(?:കിട്ടാനുണ്ട്|ബാക്കിയുണ്ട്)|(?:मेरे )?कितने पैसे बाकी हैं|कितनी मज़दूरी बाकी है)$/u.test(command)) {
      return result({ intent: 'QUERY_BALANCE', parameters: {} })
    }
    const employer = /^add (?:worksite|employer) (.+?)(?: at (.+?)(?: per day)?)?$/i.exec(original) ??
      /^(.+?) ജോലിസ്ഥലം ചേർക്കുക(?:,? ദിവസക്കൂലി (.+))?$/u.exec(original) ??
      /^(.+?) कार्यस्थल जोड़ें(?:,? दिहाड़ी (.+))?$/u.exec(original)
    if (employer) {
      const rate = employer[2] ? parseAmount(employer[2].toLowerCase()) : null
      return result({ intent: 'CREATE_EMPLOYER', parameters: { name: employer[1], rate } },
        rate === null ? ['rate'] : [], employer[2] && rate === null ? 'number' : null)
    }
    const wage = /^(?:(?:set (?:my )?|my )?(?:daily wage|wage)(?: is| to)?\s*(.*)|(?:എന്റെ )?ദിവസ(?:ക്കൂലി|കൂലി)\s*(.*)|(?:मेरी )?दिहा(?:ड़ी|डी)\s*(.*?)(?: है)?)$/u.exec(command)
    if (wage) {
      const raw = wage.slice(1).find(value => value !== undefined) ?? ''
      const rate = parseAmount(raw)
      return result({ intent: 'SET_DAILY_WAGE', parameters: { rate } }, rate === null ? ['rate'] : [], raw && rate === null ? 'number' : null)
    }
    const payment = /^(?:(?:i )?received\s*(.*)|record payment\s*(.*)|എനിക്ക് (.*?)\s*(?:കിട്ടി|ലഭിച്ചു)|मुझे (.*?)\s*(?:मिले|मिला))$/u.exec(command)
    if (payment) {
      const raw = payment.slice(1).find(value => value !== undefined) ?? ''
      const amount = parseAmount(raw)
      return result({ intent: 'RECORD_PAYMENT', parameters: { amount } }, amount === null ? ['amount'] : [], raw && amount === null ? 'number' : null)
    }

    const englishWork = /^(?:i )?worked(?: (?!on )(.*?))?(?: on (\d{4}-\d{2}-\d{2}))?$/u.exec(command)
    const mlWork = /^(?:ഞാൻ )?(?:(ഇന്ന്|ഇന്നലെ|.+? ദിവസം) )?(?:ജോലി|work) ചെയ്തു$/u.exec(command)
    const hiWork = /^(?:मैंने )?(?:(आज|कल|.+? दिन) )?काम किया$/u.exec(command)
    if (englishWork || mlWork || hiWork) {
      const when = (englishWork ?? mlWork ?? hiWork)?.[1]
      const explicitDate = englishWork?.[2]
      const count = when?.match(/^(.+?) (?:days?|ദിവസം|दिन)$/u)?.[1]
      const days = count ? (/^\d+$/.test(count) ? Number(count) : spokenInteger(count)) :
        (!when || ['today', 'yesterday', 'ഇന്ന്', 'ഇന്നലെ', 'आज', 'कल'].includes(when) ? 1 : null)
      const date = explicitDate ? ((!when || count) && validDate(explicitDate, today) ? explicitDate : null) :
        (['yesterday', 'ഇന്നലെ', 'कल'].includes(when ?? '') ? previousDate(today) : today)
      const validDays = days !== null && Number.isInteger(days) && days >= 1 && days <= 366
      const missing: Details['missing'] = []
      if (!validDays) missing.push('days')
      if (!date) missing.push('date')
      return result({ intent: 'RECORD_WORK', parameters: { days: validDays ? days : null, date } }, missing,
        !validDays ? 'number' : !date ? 'date' : null)
    }
    return result({ intent: 'UNKNOWN', parameters: {} }, [], /\band\b|\bor\b|या|അല്ലെങ്കിൽ/u.test(command) ? 'command' : null)
  },
}
