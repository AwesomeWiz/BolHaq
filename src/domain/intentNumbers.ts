import { readPaise } from './ledger'

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

export function spokenInteger(input: string): number | null {
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

const currencyWord = String.raw`(?:rupees?|rupaye|rupaya|rs\.?|inr|रुपये|रुपए|रुपया|रुपएँ|रुपएं|रुपयों|रुपे|(?:आई|आइ)\s*एन\s*आर|രൂപ)`
const currencyPrefix = new RegExp(String.raw`^(?:₹\s*|${currencyWord}(?:\s*:\s*|\s+|(?=\d)))`, 'u')
const currencySuffix = new RegExp(String.raw`(?:₹|രൂപ(?:യാണ്|ആണ്)?|(?<=[\s\d])${currencyWord})$`, 'u')

export function parseAmount(raw: string) {
  // Strip currency at the edges only. The entire remainder must be one valid number.
  const amount = raw.trim().replace(currencyPrefix, '').replace(currencySuffix, '').trim()
  const spelled = spokenInteger(amount)
  return readPaise(amount) ?? (spelled === null ? null : readPaise(String(spelled)))
}
