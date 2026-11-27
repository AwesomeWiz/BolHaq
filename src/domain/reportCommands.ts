export type ReportRequest =
  | { view: 'statement' | 'reminder'; worksiteName?: string; month?: string }
  | { view: 'overview'; month?: string }

const months = 'january february march april may june july august september october november december'.split(' ')

export function reportCommand(command: string, today: string): ReportRequest | undefined {
  const currentMonth = today.slice(0, 7)
  if (/^(?:show my wage statement(?: for this month)?|इस महीने का हिसाब दिखाओ|मेरी मज[़]?दूरी की रिपोर्ट दिखाओ|ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ|എന്റെ ശമ്പളത്തിന്റെ കണക്ക് കാണിക്കൂ)$/iu.test(command)) {
    return { view: 'statement', month: currentMonth }
  }

  const statement = /^make a report for (.+)$/i.exec(command)
  if (statement) return { view: 'statement', worksiteName: statement[1], month: currentMonth }

  const month = /^show my (?:earnings|wage statement) for (\w+)$/i.exec(command)
  if (month) {
    const number = months.indexOf(month[1].toLowerCase()) + 1
    if (number) {
      const year = Number(today.slice(0, 4)) - Number(number > Number(today.slice(5, 7)))
      return { view: 'statement', month: `${year}-${String(number).padStart(2, '0')}` }
    }
  }

  if (/^(?:prepare a payment reminder|बाकी मज[़]?दूरी के लिए संदेश बनाओ|ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ)$/iu.test(command)) {
    return { view: 'reminder' }
  }
  const reminder = /^(?:prepare a payment reminder for (.+)|ask (.+) for my remaining wages)$/i.exec(command)
  if (reminder) return { view: 'reminder', worksiteName: reminder[1] ?? reminder[2] }

  if (/^(?:how much am i owed across all worksites|show my total outstanding wages|मुझे कुल कितने पैसे मिलने बाकी हैं|सभी काम की जगहों का हिसाब दिखाओ|എനിക്ക് ആകെ എത്ര കൂലി കിട്ടാനുണ്ട്|എല്ലാ ജോലിസ്ഥലങ്ങളിലെയും കണക്ക് കാണിക്കൂ)$/iu.test(command)) {
    return { view: 'overview' }
  }
  if (/^how much did i earn this month$/i.test(command)) return { view: 'overview', month: currentMonth }
}
