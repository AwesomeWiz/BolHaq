import { localDate, validDate } from './ledger'
import { parseAmount, spokenInteger } from './intentNumbers'
import { normalizeTranscript, shiftDate } from './transcript'
import { reportCommand } from './reportCommands'
import type { ReportRequest } from './reportCommands'

type Action =
  | { intent: 'SET_DAILY_WAGE'; parameters: { rate: number | null } }
  | { intent: 'RECORD_PAYMENT'; parameters: { amount: number | null } }
  | { intent: 'RECORD_WORK'; parameters: { days: number | null; date: string | null } }
  | { intent: 'CREATE_EMPLOYER'; parameters: { name: string; rate: number | null } }
  | { intent: 'OPEN_REPORT'; parameters: ReportRequest }
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

export function knownCommand(transcript: string, today = localDate(), original = normalizeTranscript(transcript)): ParsedIntent {
  const command = original.toLowerCase()
  function result(action: Action, missing: Details['missing'] = [], ambiguity: Details['ambiguity'] = null): ParsedIntent {
    return { ...action, transcript, missing, ambiguity,
      requiresConfirmation: !['QUERY_BALANCE', 'OPEN_REPORT', 'UNKNOWN'].includes(action.intent) }
  }
  const report = reportCommand(original, today)
  if (report) return result({ intent: 'OPEN_REPORT', parameters: report })
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
  const hindiPayment = /^मुझे(?:\s*[:,]\s*|\s+)(.*?)\s*(?:मिले|मिला)$/u.exec(command)
  const payment = /^(?:(?:i )?received|record payment)(?=$|[\s:,₹])\s*[:,]?\s*(.*)$/u.exec(command) ??
    /^എനിക്ക്(?:\s*[:,]\s*|\s+)(.*?)\s*(?:കിട്ടി|ലഭിച്ചു)$/u.exec(command) ?? hindiPayment
  if (payment) {
    const [, raw] = payment
    // The Hindi recognizer can transcribe a currency prefix as आईएस.
    // Accept it only in a payment phrase directly before a numeric amount.
    const amount = parseAmount(hindiPayment ? raw.replace(/^आई\s*एस(?=\s+\d)/u, '₹') : raw)
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
      (['yesterday', 'ഇന്നലെ', 'कल'].includes(when ?? '') ? shiftDate(today, -1) : today)
    const validDays = days !== null && Number.isInteger(days) && days >= 1 && days <= 366
    const missing: Details['missing'] = []
    if (!validDays) missing.push('days')
    if (!date) missing.push('date')
    return result({ intent: 'RECORD_WORK', parameters: { days: validDays ? days : null, date } }, missing,
      !validDays ? 'number' : !date ? 'date' : null)
  }
  return result({ intent: 'UNKNOWN', parameters: {} }, [], /\band\b|\bor\b|या|അല്ലെങ്കിൽ/u.test(command) ? 'command' : null)
}

export const intentParser: VoiceIntentParser = { parse: knownCommand }
