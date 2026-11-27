import { en } from './en'
import { ml } from './ml'
import { hi } from './hi'

export const languages = [
  { code: 'en-IN', label: 'English', messages: en, examples: [
    'I worked today.', 'My daily wage is 700 rupees.', 'I received 2000 rupees.', 'How much money am I owed?',
    'Add worksite ABC Construction at 700 rupees per day.',
  ] },
  { code: 'ml-IN', label: 'മലയാളം', messages: ml, examples: [
    'ഞാൻ ഇന്ന് ജോലി ചെയ്തു.', 'എന്റെ ദിവസക്കൂലി 700 രൂപയാണ്.', 'എനിക്ക് 2000 രൂപ കിട്ടി.', 'എനിക്ക് ഇനി എത്ര രൂപ കിട്ടാനുണ്ട്?',
    'കലൂർ ജോലിസ്ഥലം ചേർക്കുക, ദിവസക്കൂലി 700 രൂപ.',
  ] },
  { code: 'hi-IN', label: 'हिंदी', messages: hi, examples: [
    'मैंने आज काम किया।', 'मेरी दिहाड़ी 700 रुपये है।', 'मुझे 2000 रुपये मिले।', 'मेरे कितने पैसे बाकी हैं?',
    'कलूर कार्यस्थल जोड़ें, दिहाड़ी 700 रुपये।',
  ] },
] as const

export type Locale = typeof languages[number]['code']

export function money(paise: number, locale: Locale) {
  const fraction = Math.abs(paise % 100)
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'INR', minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: fraction ? 2 : 0,
  }).formatToParts(Math.sign(paise) * Math.floor(Math.abs(paise) / 100))
  return formatted.map(part => part.type === 'fraction'
    ? new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(fraction)
    : part.value).join('')
}

export function dateLabel(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date + 'T12:00:00'))
}
