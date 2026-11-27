/**
 * POST /api/speech/narration
 * Cloudflare Pages Function — Fixed-step onboarding narration using Sarvam Bulbul v3.
 *
 * Security & privacy controls:
 *  - Strict allowlist of valid onboarding step IDs (language, site, mic, review, reports)
 *  - Locale allowlist (ml-IN, hi-IN)
 *  - Pre-approved, fixed narration strings ONLY. Arbitrary text input is strictly rejected.
 *  - Output cached via Cache-Control / KV
 *  - Rate limited to protect against abusive repeated requests
 */

interface Env {
  SARVAM_API_KEY?: string
  CLOUD_SPEECH_ENABLED?: string
  SPEECH_KV?: KVNamespace
}

const ALLOWED_STEPS = new Set(['language', 'site', 'mic', 'review', 'reports'])
const ALLOWED_LOCALES = new Set(['ml-IN', 'hi-IN'])
const UPSTREAM_TIMEOUT_MS = 15_000
const RATE_PER_MIN = 10
const RATE_PER_DAY = 50
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech'

// Fixed narration strings matching src/locales/onboarding.ts exactly
const FIXED_NARRATION: Record<string, Record<string, string>> = {
  'ml-IN': {
    language: 'നിങ്ങൾക്ക് സൗകര്യമുള്ള ഭാഷ തിരഞ്ഞെടുക്കുക. ഭാഷ എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.',
    site: 'നിങ്ങൾ ജോലി ചെയ്യുന്ന സ്ഥലമോ തൊഴിലുടമയെയോ ചേർക്കുക. ഇപ്പോഴോ പിന്നീടോ ചേർക്കാം.',
    mic: 'മൈക്രോഫോൺ അമർത്തി ചെയ്ത ജോലിയെക്കുറിച്ചോ കിട്ടിയ കൂലിയെക്കുറിച്ചോ പറയുക.',
    review: 'BolHaq മനസ്സിലാക്കിയ വിവരങ്ങൾ കാണിക്കും. സേവ് ചെയ്യുന്നതിനു മുമ്പ് അവ പരിശോധിക്കുക.',
    reports: 'ബാക്കി കൂലിയും കണക്കും നോക്കാം. കൂലി ചോദിക്കാൻ സന്ദേശവും തയ്യാറാക്കാം.',
  },
  'hi-IN': {
    language: 'जिस भाषा में आप सहज हैं, उसे चुनें। आप इसे कभी भी बदल सकते हैं।',
    site: 'जहाँ काम करते हैं, उस जगह या नियोक्ता को जोड़ें। यह आप अभी या बाद में कर सकते हैं।',
    mic: 'माइक्रोफ़ोन दबाएँ और अपने काम या मिले हुए पैसों के बारे में बोलें।',
    review: 'BolHaq दिखाता है कि उसने क्या समझा। सेव करने से पहले जानकारी जाँच लें।',
    reports: 'बाकी मज़दूरी और हिसाब देखें। पैसे माँगने के लिए संदेश भी तैयार कर सकते हैं।',
  },
}

function noStoreAudio(body: ArrayBuffer, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
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
  return `narration:${truncated}`
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

  const { step, locale } = body as Record<string, unknown>

  if (typeof step !== 'string' || !ALLOWED_STEPS.has(step)) {
    return errorResponse('invalid_step', 400)
  }
  if (typeof locale !== 'string' || !ALLOWED_LOCALES.has(locale)) {
    return errorResponse('invalid_locale', 400)
  }

  const narrationText = FIXED_NARRATION[locale]?.[step]
  if (!narrationText) {
    return errorResponse('step_not_found', 404)
  }

  // Check KV cache for previously generated audio of this fixed step
  const cacheKey = `narration_audio:${locale}:${step}`
  if (env.SPEECH_KV) {
    const cachedB64 = await env.SPEECH_KV.get(cacheKey)
    if (cachedB64) {
      const binary = base64ToArrayBuffer(cachedB64)
      return noStoreAudio(binary, 'audio/mpeg')
    }
  }

  const speaker = locale === 'ml-IN' ? 'pooja' : 'shubh'

  const ttsBody = JSON.stringify({
    inputs: [narrationText],
    target_language_code: locale,
    model: 'bulbul:v3',
    speaker,
    speech_sample_rate: 22050,
    pace: 0.95,
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

  let sarvamJson: unknown
  try {
    sarvamJson = await sarvamResponse.json()
  } catch {
    return errorResponse('invalid_response', 502)
  }

  const audioB64 = extractAudio(sarvamJson)
  if (!audioB64) return errorResponse('no_audio', 502)

  // Cache fixed audio in KV permanently
  if (env.SPEECH_KV) {
    await env.SPEECH_KV.put(cacheKey, audioB64)
  }

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
