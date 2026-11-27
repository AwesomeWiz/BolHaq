import { en } from './en'
import { ml } from './ml'
import { hi } from './hi'

export const languages = [
  { code: 'en-IN', label: 'English', messages: en, examples: [
    'I worked today.', 'My daily wage is 700 rupees.', 'I received 2000 rupees.', 'How much money am I owed?',
    'Add worksite ABC Construction at 700 rupees per day.',
    'Show my wage statement for this month.', 'Prepare a payment reminder.', 'How much am I owed across all worksites?',
  ] },
  { code: 'ml-IN', label: 'മലയാളം', messages: ml, examples: [
    'ഞാൻ ഇന്ന് ജോലി ചെയ്തു.', 'എന്റെ ദിവസക്കൂലി 700 രൂപയാണ്.', 'എനിക്ക് 2000 രൂപ കിട്ടി.', 'എനിക്ക് ഇനി എത്ര രൂപ കിട്ടാനുണ്ട്?',
    'കലൂർ ജോലിസ്ഥലം ചേർക്കുക, ദിവസക്കൂലി 700 രൂപ.',
    'ഈ മാസത്തെ കൂലിയുടെ കണക്ക് കാണിക്കൂ.', 'ബാക്കി കൂലി ചോദിക്കാൻ ഒരു മെസേജ് തയ്യാറാക്കൂ.', 'എല്ലാ ജോലിസ്ഥലങ്ങളിലെയും കണക്ക് കാണിക്കൂ.',
  ] },
  { code: 'hi-IN', label: 'हिंदी', messages: hi, examples: [
    'मैंने आज काम किया।', 'मेरी दिहाड़ी 700 रुपये है।', 'मुझे 2000 रुपये मिले।', 'मेरे कितने पैसे बाकी हैं?',
    'कलूर कार्यस्थल जोड़ें, दिहाड़ी 700 रुपये।',
    'इस महीने का हिसाब दिखाओ।', 'बाकी मजदूरी के लिए संदेश बनाओ।', 'सभी काम की जगहों का हिसाब दिखाओ।',
  ] },
] as const

export type Locale = typeof languages[number]['code']

export function money(paise: number | bigint, locale: Locale) {
  const amount = BigInt(paise)
  const magnitude = amount < 0n ? -amount : amount
  const fraction = Number(magnitude % 100n)
  const whole = amount / 100n
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'INR', minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: fraction ? 2 : 0,
  }).formatToParts(whole === 0n && amount < 0n ? -0 : whole)
  return formatted.map(part => part.type === 'fraction'
    ? new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(fraction)
    : part.value).join('')
}

export function dateLabel(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date + 'T12:00:00'))
}
