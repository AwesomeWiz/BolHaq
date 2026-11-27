import { knownCommand } from './intent'
import type { ParsedIntent } from './intent'
import { parseAmount } from './intentNumbers'
import { readCommand } from './intentReads'
import type { ReadSlots } from './intentReads'
import { writeCommand } from './intentWrites'
import type { WriteSlots } from './intentWrites'
import { localDate } from './ledger'
import { matchingWorksites } from './reports'
import { normalizeTranscript } from './transcript'

export type MissingSlot = 'amount' | 'days' | 'rate' | 'date' | 'name' | 'worksite'
export type InterpretationStatus = 'understood' | 'missing' | 'ambiguous' | 'unsupported'
export type InterpretationIssue = 'amount' | 'details' | 'worksite' | 'worksiteAmbiguous' | 'paymentState' | 'oneAction'
type Unknown = { intent: 'UNKNOWN'; parameters: Record<string, never> }
type Detected = WriteSlots | ReadSlots | Unknown | { intent: 'PAYMENT_NOT_RECEIVED'; parameters: Record<string, never> }

export type IntentContext = {
  today?: string
  worksites?: readonly { id: string; name: string }[]
  activeWorksiteId?: string | null
}

export type Interpretation = Detected & {
  original: string
  status: InterpretationStatus
  missing: MissingSlot[]
  issue?: InterpretationIssue
  worksiteId?: string
  requiresConfirmation: boolean
}

const writes = new Set<Detected['intent']>(['RECORD_WORK', 'RECORD_PAYMENT', 'SET_DAILY_WAGE', 'CREATE_WORKSITE'])

function previousCommand(parsed: ParsedIntent): Detected {
  const ambiguous = Boolean(parsed.ambiguity)
  switch (parsed.intent) {
    case 'QUERY_BALANCE': return { intent: 'QUERY_WORKSITE_BALANCE', parameters: {} }
    case 'OPEN_REPORT': {
      const { view, month } = parsed.parameters
      if (view === 'overview') return { intent: 'QUERY_TOTAL_BALANCE', parameters: { month } }
      return { intent: view === 'statement' ? 'GENERATE_WAGE_REPORT' : 'PREPARE_PAYMENT_REMINDER',
        parameters: { month }, reference: parsed.parameters.worksiteName }
    }
    case 'CREATE_EMPLOYER': return { intent: 'CREATE_WORKSITE', parameters: parsed.parameters, ambiguous }
    case 'SET_DAILY_WAGE': return { intent: parsed.intent, parameters: parsed.parameters, ambiguous }
    case 'RECORD_PAYMENT': return { intent: parsed.intent, parameters: parsed.parameters, ambiguous }
    case 'RECORD_WORK': return { intent: parsed.intent, parameters: parsed.parameters, ambiguous }
    default: return { intent: 'UNKNOWN', parameters: {} }
  }
}

function paymentTopic(text: string) {
  return /\b(?:receive[ds]?|paid|pay|wages|payment|gave|given|got)\b|मिल|भुगतान|रुपये|पैसे|मज़?दूरी|കിട്ട|ലഭി|കൂലി|പണം|തന്നു|തരും/iu.test(text)
}

function multipleActions(text: string) {
  // A conjunction inside a number ("one hundred and fifty") is not an action boundary.
  const boundary = /(?:[,;.!?।] *|\b(?:and|then)\b +|(?: और | फिर | തുടർന്ന് | പിന്നെ ))(?:i |they |also |please )?(?:received|got paid|paid me|worked|record (?:work|payment)|set (?:my )?daily|show my|prepare a payment|मुझे |मैंने |भुगतान दर्ज|काम दर्ज|എനിക്ക് |ഞാൻ |കൂലി ചേർക്ക)/giu
  const action = /\b(?:work(?:ed)?|paid|payment|wages?|received|gave|got|show|switch|report|reminder)\b|काम|हाजिरी|मिले|दिए|भुगतान|मज़?दूरी|ജോലി|പണി|കിട്ടി|തന്നു|കൂലി/iu
  return [...text.matchAll(boundary)].some(match => action.test(text.slice(0, match.index)))
}

function nonCompleted(text: string, original: string) {
  return /[?？]\s*$/u.test(original) ||
    /\b(?:not|never|nobody|haven't|hasn't|didn't|don't|wasn't|won't|will|would|should|might|expect(?:ing|ed)?|promis(?:ed|e)|tomorrow|next week|next month|owes? me|still waiting)\b|नहीं|नही|मिलेंगे|मिलेगा|मिलेगी|देगा|देंगे|उम्मीद|वादा|കിട്ടിയില്ല|കിട്ടിയിട്ടില്ല|ലഭിച്ചില്ല|ലഭിച്ചിട്ടില്ല|നാളെ|തരുമെന്ന്|കിട്ടുമെന്ന|പ്രതീക്ഷ/iu.test(text) ||
    /^(?:did |have i |was i |will |can i get |क्या |എനിക്ക് .*കിട്ടിയോ)/iu.test(text)
}

function clearNonPayment(text: string, original: string) {
  if (/[?？]\s*$/u.test(original) ||
      /^(?:क्या |अगर |यदि )|नहीं पता|शायद|लगता है|തോന്നുന്നു|എങ്കിൽ|ആണോ/iu.test(text)) return false

  const english = /^i (?:haven't|have not|didn't|did not|never) (.+)$/iu.exec(text)?.[1]
  if (english) {
    const statement = english.replace(/ (?:yet|today|yesterday)$/iu, '')
    if (/^(?:been paid|get paid|got paid)$/iu.test(statement)) return true
    const object = /^(?:received?|get|got) (.+)$/iu.exec(statement)?.[1]
    if (object && (/^(?:anything|(?:(?:any|my|the|a) )?(?:money|wages|pay(?:ment)?))$/iu.test(object) ||
        parseAmount(object.toLowerCase()) !== null)) return true
  }

  const hindi = /(?:रुपय|रुपए|पैसे|भुगतान|मज़?दूरी|₹)/u.test(text) && /(?:^| )(?:नहीं|नही) (?:मिले|मिला|मिली)$/u.test(text)
  const malayalam = /(?:കൂലി|പണം|രൂപ|₹)/u.test(text) &&
    /(?:കിട്ടിയില്ല|കിട്ടിയിട്ടില്ല|ലഭിച്ചില്ല|ലഭിച്ചിട്ടില്ല)(?: ഇതുവരെ)?$/u.test(text)
  return hindi || malayalam
}

function finalize(detected: Detected, original: string, context: IntentContext, issue?: InterpretationIssue): Interpretation {
  const missing: MissingSlot[] = []
  switch (detected.intent) {
    case 'RECORD_PAYMENT':
      if (detected.parameters.amount === null) missing.push('amount')
      if (detected.parameters.date === null) missing.push('date')
      break
    case 'RECORD_WORK':
      if (detected.parameters.days === null) missing.push('days')
      if (detected.parameters.date === null) missing.push('date')
      break
    case 'CREATE_WORKSITE':
      if (!detected.parameters.name) missing.push('name')
      if (detected.parameters.rate === null) missing.push('rate')
      break
    case 'SET_DAILY_WAGE':
      if (detected.parameters.rate === null) missing.push('rate')
  }
  const reference = 'reference' in detected ? detected.reference : undefined
  const needsSite = !['UNKNOWN', 'PAYMENT_NOT_RECEIVED', 'CREATE_WORKSITE', 'QUERY_TOTAL_BALANCE'].includes(detected.intent)
  let worksiteId: string | undefined
  if (needsSite && context.worksites) {
    if (reference) {
      const candidates = matchingWorksites(context.worksites, reference)
      if (candidates.length === 1) worksiteId = candidates[0].id
      else {
        missing.push('worksite')
        issue = candidates.length > 1 ? 'worksiteAmbiguous' : 'worksite'
      }
    } else if (detected.intent === 'SELECT_WORKSITE') {
      missing.push('worksite')
      issue = 'worksite'
    } else if (context.worksites.some(site => site.id === context.activeWorksiteId)) {
      worksiteId = context.activeWorksiteId ?? undefined
    } else {
      missing.push('worksite')
      issue = 'worksite'
    }
  }
  const ambiguous = ('ambiguous' in detected && detected.ambiguous) || missing.includes('date') || issue === 'worksiteAmbiguous'
  const status = detected.intent === 'UNKNOWN' ? (issue ? 'ambiguous' : 'unsupported') : ambiguous ? 'ambiguous' :
    missing.length ? 'missing' : 'understood'
  return { ...detected, original, status, missing, issue: issue ?? (missing.includes('amount') ? 'amount' :
    status === 'missing' || status === 'ambiguous' ? 'details' : undefined),
    worksiteId, requiresConfirmation: writes.has(detected.intent) || detected.intent === 'SELECT_WORKSITE' }
}

export function interpretIntent(original: string, context: IntentContext = {}): Interpretation {
  const unknown: Unknown = { intent: 'UNKNOWN', parameters: {} }
  if (original.length > 2048) return finalize(unknown, original, context, 'oneAction')
  const today = context.today ?? localDate()
  const text = normalizeTranscript(original)
  if (multipleActions(text)) return finalize(unknown, original, context, 'oneAction')
  if (clearNonPayment(text, original)) return finalize({ intent: 'PAYMENT_NOT_RECEIVED', parameters: {} }, original, context)

  const legacy = knownCommand(original, today, text)
  const previous = previousCommand(legacy)
  if (legacy.intent === 'QUERY_BALANCE' || legacy.intent === 'OPEN_REPORT') return finalize(previous, original, context)
  // Keep read-only phrasing available even when it mentions "unpaid" or ends in a question.
  const question = readCommand(text, today)
  if (question) return finalize(question, original, context)
  if (nonCompleted(text, original)) return finalize(unknown, original, context, paymentTopic(text) ? 'paymentState' : undefined)

  // Preserve complete existing commands. Extended frames add slots for dates, actors and new phrasing.
  const detected = legacy.requiresConfirmation && legacy.missing.length === 0 && legacy.ambiguity === null
    ? previous : writeCommand(text, today) ?? previous
  return finalize(detected, original, context)
}
