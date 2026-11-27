/**
 * POST /api/speech/balance
 * Cloudflare Pages Function — Sarvam Bulbul text-to-speech proxy for wage-balance playback.
 *
 * Required Cloudflare Pages secret: SARVAM_API_KEY
 * Optional:  CLOUD_SPEECH_ENABLED=true  (must be explicitly set to enable)
 *
 * Privacy: receives only { locale, paise, balanceType } — never worksite names,
 * employer info, payment history, or worker identity.
 * The speech text is generated server-side from the validated integer-paise amount.
 *
 * Security controls:
 *  - Validates locale to hi-IN or ml-IN only
 *  - Validates balanceType to outstanding | advance | settled
 *  - Validates paise as a non-negative integer
 *  - Caps paise at 10 crore (₹10,00,000 = 1_000_000_00 paise) for TTS length safety
 *  - Per-IP rate limiting via Cloudflare KV (if SPEECH_KV binding present)
 *  - Rejects arbitrary text input
 */

interface Env {
  SARVAM_API_KEY?: string
  CLOUD_SPEECH_ENABLED?: string
  SPEECH_KV?: KVNamespace
}

const ALLOWED_LOCALES = new Set(['hi-IN', 'ml-IN'])
const ALLOWED_BALANCE_TYPES = new Set(['outstanding', 'advance', 'settled'])
const MAX_PAISE = 100_000_000_00  // ₹10 crore in paise
const UPSTREAM_TIMEOUT_MS = 15_000
const RATE_PER_MIN = 10
const RATE_PER_DAY = 60
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech'

type BalanceType = 'outstanding' | 'advance' | 'settled'

function noStoreAudio(body: ArrayBuffer, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  })
}

function noStore(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function errorResponse(code: string, status: number): Response {
  return noStore(JSON.stringify({ error: code }), status)
}

function clientKey(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const truncated = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip
  return `tts:${truncated}`
}

async function checkRateLimit(kv: KVNamespace, key: string): Promise<{ allowed: boolean }> {
  const now = Math.floor(Date.now() / 1000)
  const minKey = `${key}:min:${Math.floor(now / 60)}`
  const dayKey = `${key}:day:${Math.floor(now / 86400)}`
  const [minRaw, dayRaw] = await Promise.all([kv.get(minKey), kv.get(dayKey)])
  const minCount = minRaw ? parseInt(minRaw, 10) : 0
  const dayCount = dayRaw ? parseInt(dayRaw, 10) : 0
  if (minCount >= RATE_PER_MIN || dayCount >= RATE_PER_DAY) return { allowed: false }
  await Promise.all([
    kv.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 172800 }),
  ])
  return { allowed: true }
}

// ----- Balance text construction (server-side only) -----

function paiseToHindi(paise: number): string {
  const rupees = Math.floor(paise / 100)
  const cents = paise % 100
  const rupeePart = formatHindiNumber(rupees) + ' रुपये'
  if (cents === 0) return rupeePart
  return rupeePart + ' और ' + cents + ' पैसे'
}

function formatHindiNumber(n: number): string {
  if (n === 0) return 'शून्य'
  if (n < 1000) return n.toString()
  if (n < 100_000) {
    const h = Math.floor(n / 1000)
    const r = n % 1000
    return r ? `${h} हज़ार ${r}` : `${h} हज़ार`
  }
  if (n < 10_000_000) {
    const l = Math.floor(n / 100_000)
    const r = n % 100_000
    return r ? `${l} लाख ${r}` : `${l} लाख`
  }
  const c = Math.floor(n / 10_000_000)
  const r = n % 10_000_000
  return r ? `${c} करोड़ ${r}` : `${c} करोड़`
}

function paiseToMalayalam(paise: number): string {
  const rupees = Math.floor(paise / 100)
  const cents = paise % 100
  const rupeePart = rupees + ' രൂപ'
  if (cents === 0) return rupeePart
  return rupeePart + ', ' + cents + ' പൈസ'
}

function buildBalanceText(locale: string, paise: number, balanceType: BalanceType): string {
  if (locale === 'hi-IN') {
    const amount = paiseToHindi(paise)
    if (balanceType === 'settled') return 'आपकी सभी मज़दूरी का भुगतान हो चुका है।'
    if (balanceType === 'advance') return `${amount} अग्रिम मिला है।`
    return `आपके ${amount} बाकी हैं।`
  }
  // ml-IN
  const amount = paiseToMalayalam(paise)
  if (balanceType === 'settled') return 'കൂലി മുഴുവൻ കിട്ടി.'
  if (balanceType === 'advance') return `${amount} മുൻകൂറായി കിട്ടി.`
  return `നിങ്ങൾക്ക് ${amount} കിട്ടാനുണ്ട്.`
}

function speakerFor(locale: string): string {
  // bulbul:v3 speakers — pooja (female) for Malayalam, shubh (male) for Hindi.
  return locale === 'ml-IN' ? 'pooja' : 'shubh'
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (env.CLOUD_SPEECH_ENABLED !== 'true' || !env.SARVAM_API_KEY) {
    return errorResponse('disabled', 503)
  }

  if (env.SPEECH_KV) {
    const { allowed } = await checkRateLimit(env.SPEECH_KV, clientKey(request))
    if (!allowed) return errorResponse('quota', 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('invalid_body', 400)
  }
  if (typeof body !== 'object' || body === null) return errorResponse('invalid_body', 400)

  const { locale, paise, balanceType } = body as Record<string, unknown>

  if (typeof locale !== 'string' || !ALLOWED_LOCALES.has(locale)) {
    return errorResponse('invalid_locale', 400)
  }
  if (typeof balanceType !== 'string' || !ALLOWED_BALANCE_TYPES.has(balanceType)) {
    return errorResponse('invalid_balance_type', 400)
  }
  if (typeof paise !== 'number' || !Number.isInteger(paise) || paise < 0 || paise > MAX_PAISE) {
    return errorResponse('invalid_paise', 400)
  }

  const text = buildBalanceText(locale, paise as number, balanceType as BalanceType)

  const ttsBody = JSON.stringify({
    inputs: [text],
    target_language_code: locale,
    model: 'bulbul:v3',
    speaker: speakerFor(locale),
    speech_sample_rate: 22050,
    pace: 1.0,
    output_audio_codec: 'mp3',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let sarvamResponse: Response
  try {
    sarvamResponse = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': env.SARVAM_API_KEY,
      },
      body: ttsBody,
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    const isTimeout = error instanceof DOMException && error.name === 'AbortError'
    return errorResponse(isTimeout ? 'upstream_timeout' : 'upstream_error', isTimeout ? 504 : 502)
  } finally {
    clearTimeout(timer)
  }

  if (!sarvamResponse.ok) {
    const status = sarvamResponse.status === 429 ? 429 : 502
    return errorResponse(status === 429 ? 'quota' : 'upstream_error', status)
  }

  // Sarvam TTS returns JSON: { audios: ["<base64 mp3>", ...] }
  let sarvamJson: unknown
  try {
    sarvamJson = await sarvamResponse.json()
  } catch {
    return errorResponse('invalid_response', 502)
  }

  const audioB64 = extractAudio(sarvamJson)
  if (!audioB64) return errorResponse('no_audio', 502)

  // Decode base64 → binary and return as audio/mpeg.
  const binary = base64ToArrayBuffer(audioB64)
  return noStoreAudio(binary, 'audio/mpeg')
}

function extractAudio(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>
  const audios = obj.audios
  if (!Array.isArray(audios) || typeof audios[0] !== 'string') return null
  return audios[0] || null
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
