export type ReportRequest =
  | { view: 'statement' | 'reminder'; worksiteName?: string; month?: string }
  | { view: 'overview'; month?: string }

const months = 'january february march april may june july august september october november december'.split(' ')

export function monthForName(name: string, today: string) {
  const number = months.indexOf(name.toLowerCase()) + 1
  if (!number) return
  const year = Number(today.slice(0, 4)) - Number(number > Number(today.slice(5, 7)))
  return `${year}-${String(number).padStart(2, '0')}`
}

function isAggregateBalance(command: string) {
  const english = /^(?:show (?:my )?(?:total|all) (?:pending|unpaid|outstanding) wages|how much payment is pending|how much am i (?:owed|old) across all worksites)$/i
  const hindi = /^(?:मेरी कुल (?:बाकी|बकाया) मज़?दूरी (?:कितनी है|बताओ)|कुल कितनी मज़?दूरी (?:बाकी|बकाया) है|मुझे कुल कितने पैसे मिलने बाकी हैं|सभी (?:काम की जगहों|कार्यस्थलों) का हिसाब दिखाओ)$/u
  if (english.test(command) || hindi.test(command)) return true

  // Speech results may contain a legacy Malayalam joiner that NFKC leaves intact.
  const malayalam = command.replace(/\u0d4d[\u200c\u200d]/gu, '\u0d4d')
  return /^(?:(?:(?:എന്റെ|എൻറെ) )?(?:[ആआ]കെ|മൊത്തം) ബാക്കി കൂലി (?:എത്ര(?:യാണ്)?|കാണിക്കൂ)|എനിക്ക് (?:[ആआ]കെ|മൊത്തം) എത്ര കൂലി (?:കിട്ടാനുണ്ട|ബാക്കിയുണ്ട)(?:്|ു്?)|എല്ലാ ജോലിസ്ഥലങ്ങളിലെയും കണക്ക് കാണിക്കൂ)$/u.test(malayalam)
}

export function reportCommand(command: string, today: string): ReportRequest | undefined {
  const currentMonth = today.slice(0, 7)
  if (/^(?:show my wage statement(?: for this month)?|इस महीने का हिसाब दिखाओ|मेरी मज[़]?दूरी की रिपोर्ट दिखाओ|ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ|എന്റെ ശമ്പളത്തിന്റെ കണക്ക് കാണിക്കൂ)$/iu.test(command)) {
    return { view: 'statement', month: currentMonth }
  }

  const statement = /^make a report for (.+)$/i.exec(command)
  if (statement) return { view: 'statement', worksiteName: statement[1], month: currentMonth }

  const month = /^show my (?:earnings|wage statement) for (\w+)$/i.exec(command)
  if (month) {
    const value = monthForName(month[1], today)
    if (value) return { view: 'statement', month: value }
  }

  if (/^(?:prepare a payment reminder|बाकी मज[़]?दूरी के लिए संदेश बनाओ|ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ)$/iu.test(command)) {
    return { view: 'reminder' }
  }
  const reminder = /^(?:prepare a payment reminder for (.+)|ask (.+) for my remaining wages)$/i.exec(command)
  if (reminder) return { view: 'reminder', worksiteName: reminder[1] ?? reminder[2] }

  if (isAggregateBalance(command)) return { view: 'overview' }
  if (/^how much did i earn this month$/i.test(command)) return { view: 'overview', month: currentMonth }
}
