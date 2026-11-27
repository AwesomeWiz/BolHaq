import { parseAmount, spokenInteger } from './intentNumbers'
import { datedText } from './transcript'

export type WriteSlots =
  | { intent: 'RECORD_PAYMENT'; parameters: { amount: number | null; date?: string | null }; reference?: string; ambiguous?: boolean }
  | { intent: 'RECORD_WORK'; parameters: { days: number | null; date?: string | null }; reference?: string; ambiguous?: boolean }
  | { intent: 'SET_DAILY_WAGE'; parameters: { rate: number | null }; reference?: string; ambiguous?: boolean }
  | { intent: 'CREATE_WORKSITE'; parameters: { name: string; rate: number | null }; ambiguous?: boolean }

const hindiPayerRole = /^(?:मेरे |मेरा )?(?:ठेकेदार|मालिक|मुंशी)$/u
const genericActor = /^(?:(?:my |the |a )?(?:contractor|supervisor|foreman|employer|boss)|they|he|she|someone|उसने|उन्होंने|(?:എന്റെ )?(?:കോൺട്രാക്ടർ|കരാറുകാരൻ|മേസ്തിരി|അവർ|അവൻ))$/iu
export function namedActor(actor?: string) {
  const name = actor?.trim()
  return name && !genericActor.test(name) && !hindiPayerRole.test(name) ? name : undefined
}

function cleanAmount(text: string) {
  return text.trim().replace(/^[:,]\s*/u, '').toLowerCase()
}

function parsePayment(frame: { phrase: string; date?: string | null; reference?: string }): Extract<WriteSlots, { intent: 'RECORD_PAYMENT' }> {
  const { date, reference } = frame
  const phrase = cleanAmount(frame.phrase)
  const vague = /^(?:some (?:money|pay)|my (?:pay|wages)|money|paid|पैसे|मज़?दूरी|भुगतान|कुछ पैसे|കൂലി|പണം|കുറച്ച് പണം)?$/iu.test(phrase)
  const amount = parseAmount(phrase)
  return { intent: 'RECORD_PAYMENT', parameters: { amount, date }, reference, ambiguous: amount === null && !vague }
}

function paymentFrame(text: string, date?: string | null) {
  const delivered = /^(.+?) (?:paid|gave) me(?: (.*)|$)/iu.exec(text)
  const self = /^(?:i )?(?:received|got(?: paid)?|was (?:given|paid)|record payment)(?=$|[ :,₹])\s*[:,]?\s*(.*)$/iu.exec(text)
  if (delivered || self) {
    const phrase = (delivered?.[2] ?? self?.[1] ?? '')
      .replace(/^(?:a payment of|a sum of) /iu, '')
      .replace(/ for (?:my work|the (?:work|shift)|that shift|my shift)$/iu, '')
    const source = /^(.+?) +(?:from|at) (.+)$/iu.exec(phrase)
    return parsePayment({
      date, phrase: source?.[1] ?? phrase, reference: namedActor(source?.[2] ?? delivered?.[1]),
    })
  }

  const hindi = /^(.*?)(?:^| )(मिले|मिला|मिली|मिल गए|मिल गई|(?:दे )?(?:दिए|दी|दिया))$/u.exec(text)
  if (hindi) {
    const actor = /^(.+?) ने (.*)$/u.exec(hindi[1])
    const body = actor?.[2] ?? hindi[1]
    const self = /^(?:मुझे|मुझको)(?:[ :,]+(.*)|$)/u.exec(body)
    const gave = /^(?:दे )?(?:दिए|दी|दिया)$/u.test(hindi[2])
    const implicitRecipient = !self && gave && !!actor && hindiPayerRole.test(actor[1])
    if (!self && (gave || actor) && !implicitRecipient) return
    let rest = (self ? self[1] ?? '' : body).trim()
    if (!actor && !self && !/(?:रुप|₹|\binr\b|भुगतान|मज़?दूरी|पैसे| से )/iu.test(rest)) return
    const source = /^(.+?) से (.+)$/u.exec(rest)
    rest = (source?.[2] ?? rest).replace(/ (?:का भुगतान|की मज़?दूरी)$/u, '')
      .replace(/^आई\s*एस(?=\s+\d)/u, '₹')
    const payment = parsePayment({ date, phrase: rest, reference: namedActor(source?.[1] ?? actor?.[1]) })
    // An omitted recipient is safe to review only with a known payer role and a clean amount.
    if (!implicitRecipient || (!source && payment.parameters.amount !== null)) return payment
    return
  }

  const malayalam = /^(.*?)(?:^| )(കിട്ടി|ലഭിച്ചു|തന്നു)$/u.exec(text)
  if (malayalam) {
    const source = /^(.+?)(?:-ൽ|യിൽ|ൽ)? നിന്ന് (.+)$/u.exec(malayalam[1])
    const rest = source?.[2] ?? malayalam[1]
    const recipient = /^(?:(.+?) )?എനിക്ക്(?: (.*)|$)/u.exec(rest)
    if (malayalam[2] === 'തന്നു' && !recipient) return
    if (!recipient && !/(?:രൂപ|കൂലി|പണം|₹|\brupees?\b|പേയ്[\u200c\u200d]?മെന്റ്)/iu.test(rest)) return
    const phrase = (recipient?.[2] ?? (recipient ? '' : rest))
      .replace(/(?:യുടെ|യുടെ )? (?:പേയ്[\u200c\u200d]?മെന്റ്|കൂലി)$/u, '')
      .replace(/രൂപയുടെ$/u, 'രൂപ')
    return parsePayment({ date, phrase, reference: namedActor(source?.[1] ?? recipient?.[1]) })
  }
}

function workCount(text: string) {
  const phrase = text.trim().toLowerCase()
  if (!phrase) return null
  const days = /^\d+$/u.test(phrase) ? Number(phrase) : spokenInteger(phrase)
  return days !== null && Number.isSafeInteger(days) && days >= 1 && days <= 366 ? days : null
}

function workFrame(text: string, date?: string | null): WriteSlots | undefined {
  const englishSite = /^(.*?) (?:at|for) (.+)$/iu.exec(text)
  const english = englishSite?.[1] ?? text
  const worked = /^(?:i )?worked(?: (.*)|$)/iu.exec(english)
  const logged = /^(?:(?:log|record|put down|add|i put in) (.+?) (?:workdays?|days? of work)|(?:mark (?:me )?present|mark (?:my )?attendance)|record (?:my )?work)$/iu.exec(english)
  if (worked || logged) {
    const words = worked?.[1]?.replace(/ days?$/iu, '') ?? logged?.[1]
    const days = words ? workCount(words) : !date && /^record (?:my )?work$/iu.test(english) ? null : 1
    return { intent: 'RECORD_WORK', parameters: { days, date },
      reference: namedActor(englishSite?.[2]), ambiguous: Boolean(words && days === null) }
  }

  const hindi = /^(.*?)(?:^| )(?:काम किया(?: था)?|काम (?:दर्ज करो|लिखो|दर्ज करें)|(?:हाजिरी|हाज़िरी) (?:दर्ज करो|लगा दो|लिखो))$/u.exec(text)
  const malayalam = /^(.*?)(?:^| )(?:ജോലി ചെയ്തു|പണിയെടുത്തു|(?:പണി|ജോലി)ക്ക[്ു] പോയി(?:രുന്നു)?|ജോലി (?:രേഖപ്പെടുത്തൂ|കണക്കിൽ ചേർക്കൂ)|ഹാജർ (?:ചേർക്കൂ|രേഖപ്പെടുത്തൂ))$/u.exec(text)
  if (!hindi && !malayalam) return
  let context = (hindi?.[1] ?? malayalam?.[1] ?? '').replace(/^(?:मैंने|मैं|मेरी|ഞാൻ)(?: |$)/u, '').trim()
  const count = /^(.*?) (?:दिन(?: का| की)?|ദിവസം|ദിവസത്തെ)(?: |$)/u.exec(context)
  if (count) context = context.slice(count[0].length).trim()
  const site = /^(.*?) में$/u.exec(context) ?? /^(.*?)(?:-ൽ|യിൽ|ൽ)$/u.exec(context)
  const days = count ? workCount(count[1]) : context && !site ? null : 1
  return { intent: 'RECORD_WORK', parameters: { days, date }, reference: namedActor(site?.[1]),
    ambiguous: days === null && Boolean(context || count) }
}

function siteCreation(text: string): WriteSlots | undefined {
  const english = /^(?:add (.+?) as (?:a )?(?:worksite|site|employer)|(?:set up|create|add) (?:a )?(?:new )?(?:worksite|site|employer)(?: called)? (.+?))(?: at (.+?)(?: per day| a day)?)?$/iu.exec(text)
  const suffix = /^(?:(.+?) (?:कार्यस्थल|जगह) (?:जोड़ो|जोड़ दें|जोड़ें)|(.+?) ജോലിസ്ഥലം (?:ചേർക്കൂ|ചേർക്കുക|ഉണ്ടാക്കൂ))(?:,? (?:दिहाड़ी|ദിവസക്കൂലി) (.*))?$/u.exec(text)
  const prefix = /^(?:नया कार्यस्थल (?:जोड़ो|जोड़ें) (.+?)|പുതിയ ജോലിസ്ഥലം (.+?) (?:ചേർക്കൂ|ചേർക്കുക))(?:,? (?:दिहाड़ी|ദിവസക്കൂലി) (.*))?$/u.exec(text)
  const frame = english ?? suffix ?? prefix
  if (!frame) return
  const rate = frame[3] ? parseAmount(cleanAmount(frame[3])) : null
  return { intent: 'CREATE_WORKSITE', parameters: { name: (frame[1] ?? frame[2]).trim(), rate },
    ambiguous: Boolean(frame[3] && rate === null) }
}

function wageFrame(text: string): WriteSlots | undefined {
  const english = /^(?:(?:set|change|make) (?:my )?|my )?(?:daily wage|daily pay|day rate)(?: is| to)?\s*(.*)$/iu.exec(text)
  const hindi = /^(?:मेरी )?(?:दिहा(?:ड़ी|डी)|रोज की मज़?दूरी) ?(.*?)(?: (?:कर दो|तय करो|रखो|है))?$/u.exec(text)
  const malayalam = /^(?:എന്റെ )?(?:ദിവസ(?:ക്കൂലി|കൂലി)|ദിവസത്തെ കൂലി) ?(.*?)(?: (?:മാറ്റൂ|നിശ്ചയിക്കൂ|ആക്കൂ|ആക്കുക))?$/u.exec(text)
  const frame = english ?? hindi ?? malayalam
  if (!frame) return
  const raw = cleanAmount(frame[1]).replace(/രൂപ(?:യാക്കി|യായി)$/u, 'രൂപ')
  const rate = parseAmount(raw)
  return { intent: 'SET_DAILY_WAGE', parameters: { rate }, ambiguous: !!raw && rate === null }
}

export function writeCommand(text: string, today: string): WriteSlots | undefined {
  const { text: undated, date } = datedText(text, today)
  return siteCreation(text) ?? paymentFrame(undated, date) ?? workFrame(undated, date) ?? wageFrame(text)
}
