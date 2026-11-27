import { monthForName } from './reportCommands'

export type ReadSlots =
  | { intent: 'SELECT_WORKSITE' | 'QUERY_WORKSITE_BALANCE'; parameters: Record<string, never>; reference?: string }
  | { intent: 'QUERY_TOTAL_BALANCE' | 'GENERATE_WAGE_REPORT' | 'PREPARE_PAYMENT_REMINDER'; parameters: { month?: string }; reference?: string }

const periodThis = /\b(?:this|current) month\b|इस महीने|ഈ മാസ(?:ത്തെ|ത്തിൽ)/iu
const periodPrevious = /\b(?:last|previous) month\b|पिछले महीने|കഴിഞ്ഞ മാസ(?:ത്തെ|ത്തിൽ)/iu
const aggregate = /\b(?:total|overall|all (?:worksites?|sites?|employers?|)?\b)|कुल|सभी|[ആआ]കെ|മൊത്തം|എല്ലാ/iu
const pending = /\b(?:pending|outstanding|unpaid|remaining|balance|left to pay|still due|owed)\b|बाकी|बकाया|ബാക്കി|കിട്ടാനുള്ള|കിട്ടാനുണ്ട/iu
const ask = /\b(?:show|how much|tell|what is|what's|check|can i see|pull up)\b|कितन[ेीा]|दिखाओ|बताओ|दिखाएँ|എത്ര|കാണിക്കൂ|പറയൂ|തരൂ/iu
const payroll = /\b(?:wages?|payment|earnings|pay)\b|मज़?दूरी|भुगतान|कमाई|കൂലി|ശമ്പളം|പണ(?:ം|ത്ത)|പേയ്[\u200c\u200d]?മെന്റ്/iu

function period(command: string, today: string) {
  if (periodPrevious.test(command)) {
    const [year, month] = today.slice(0, 7).split('-').map(Number)
    return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  }
  if (periodThis.test(command)) return today.slice(0, 7)
  const named = /\b([a-z]+) (?:earnings|wage (?:report|statement))\b/iu.exec(command)?.[1]
  if (named) {
    const month = monthForName(named, today)
    if (month) return month
  }
  for (const [, word] of command.matchAll(/ (?:for|in) ([a-z]+)(?=$| (?:at|for) )/giu)) {
    const month = monthForName(word, today)
    if (month) return month
  }
}

function reportSite(text: string, today: string) {
  for (const [, phrase] of text.matchAll(/ (?:for|at) (.+?)(?= (?:for|at) |$)/giu)) {
    const site = phrase.replace(/ (?:this|last|previous|current) month$/iu, '')
    if (!/^(?:my |this |last |previous |current |all (?:worksites?|sites?|employers?)$)/iu.test(site) &&
        !monthForName(site, today)) return site
  }
  const hindi = /^(.+?) (?:की|का|के) (?:मज़?दूरी|भुगतान|कमाई|कितना)/u.exec(text)?.[1]
  if (hindi && !/^(?:मेरी|मेरे|पिछले|इस |बाकी |कुल|सभी)/u.test(hindi)) return hindi
  return /^(.+?)(?:-ലെ|യിലെ) (?:കൂലി|ശമ്പളം|ബാക്കി|കണക്ക്)/u.exec(text)?.[1]
}

export function readCommand(text: string, today: string): ReadSlots | undefined {
  const switchEnglish = /^(?:switch to|select|choose|change to)(?: (?:the )?(?:worksite|site|employer))?(?: (.+))?$/iu.exec(text)
  const switchHindi = /^(?:(?:कार्यस्थल|जगह) )?(.+?) (?:चुनो|चुनें|चुनिए)$/u.exec(text)
  const switchMalayalam = /^(.+?)(?: ജോലിസ്ഥലത്തേക്ക് മാറൂ| തിരഞ്ഞെടുക്കൂ| തെരഞ്ഞെടുക്കൂ)$/u.exec(text)
  const selection = switchEnglish ?? switchHindi ?? switchMalayalam
  if (selection) return { intent: 'SELECT_WORKSITE', parameters: {}, reference: selection[1] }

  const message = /\b(?:message|reminder|note)\b|मैसेज|संदेश|याद दिलाने|സന്ദേശം|മെസേജ്|ഓർമ്മിപ്പിക്കാൻ/iu
  const prepare = /\b(?:draft|prepare|write|make)\b|लिखो|बनाओ|तैयार करो|എഴുതൂ|ഉണ്ടാക്കൂ|തയ്യാറാക്കൂ/iu
  if (message.test(text) && prepare.test(text) && payroll.test(text)) {
    const month = period(text, today)
    return { intent: 'PREPARE_PAYMENT_REMINDER', parameters: { month }, reference: reportSite(text, today) }
  }

  if (!ask.test(text)) return
  const reporting = /\b(?:report|statement|earnings)\b|रिपोर्ट|विवरण|कमाई|റിപ്പോർട്ട്|സ്റ്റേറ്റ്മെന്റ്|ശമ്പളത്തിന്റെ കണക്ക്/iu
  if (reporting.test(text)) {
    const month = period(text, today)
    return { intent: 'GENERATE_WAGE_REPORT', parameters: { month }, reference: reportSite(text, today) }
  }
  if (pending.test(text)) {
    const reference = reportSite(text, today)
    if (!reference && aggregate.test(text)) return { intent: 'QUERY_TOTAL_BALANCE', parameters: {} }
    return { intent: 'QUERY_WORKSITE_BALANCE', parameters: {}, reference }
  }
}
