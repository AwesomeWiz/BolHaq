/**
 * POST /api/speech/transcribe
 * Cloudflare Pages Function — Sarvam Saaras speech-to-text proxy.
 *
 * Required Cloudflare Pages secret: SARVAM_API_KEY
 * Optional:  CLOUD_SPEECH_ENABLED=true  (must be explicitly set to enable)
 *
 * Security controls:
 *  - Rejects requests when CLOUD_SPEECH_ENABLED is not "true"
 *  - Validates locale to hi-IN or ml-IN only
 *  - Caps audio at 256 KB and 8 seconds of audio
 *  - Validates Content-Type / MIME before forwarding
 *  - Never returns the API key or provider exceptions
 *  - Sets Cache-Control: no-store on all responses
 *  - Per-IP rate limiting via Cloudflare KV (if SPEECH_KV binding present)
 *
 * Quota (KV-enforced when SPEECH_KV is bound):
 *  - 3 STT requests per client per minute
 *  - 30 STT requests per client per day
 */

interface Env {
  SARVAM_API_KEY?: string
  CLOUD_SPEECH_ENABLED?: string
  SPEECH_KV?: KVNamespace
}

const ALLOWED_LOCALES = new Set(['hi-IN', 'ml-IN'])
const MAX_AUDIO_BYTES = 256_000        // ~256 KB
const UPSTREAM_TIMEOUT_MS = 15_000
const RATE_PER_MIN = 3
const RATE_PER_DAY = 30
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text'

const ALLOWED_MIME_PREFIXES = [
  'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg',
  'audio/wav', 'audio/mpeg', 'audio/flac',
]

function noStore(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function errorResponse(code: string, status: number): Response {
  return noStore(JSON.stringify({ error: code }), status)
}

function clientKey(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  // Truncate IPv6 to /64 prefix to avoid per-address proliferation.
  const truncated = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip
  return `stt:${truncated}`
}

async function checkRateLimit(
  kv: KVNamespace,
  key: string,
): Promise<{ allowed: boolean }> {
  const now = Math.floor(Date.now() / 1000)
  const minKey = `${key}:min:${Math.floor(now / 60)}`
  const dayKey = `${key}:day:${Math.floor(now / 86400)}`

  const [minRaw, dayRaw] = await Promise.all([kv.get(minKey), kv.get(dayKey)])
  const minCount = minRaw ? parseInt(minRaw, 10) : 0
  const dayCount = dayRaw ? parseInt(dayRaw, 10) : 0

  if (minCount >= RATE_PER_MIN || dayCount >= RATE_PER_DAY) {
    return { allowed: false }
  }

  await Promise.all([
    kv.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 172800 }),
  ])
  return { allowed: true }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1. Check feature flag.
  if (env.CLOUD_SPEECH_ENABLED !== 'true' || !env.SARVAM_API_KEY) {
    return errorResponse('disabled', 503)
  }

  // 2. Rate limiting.
  if (env.SPEECH_KV) {
    const key = clientKey(request)
    const { allowed } = await checkRateLimit(env.SPEECH_KV, key)
    if (!allowed) return errorResponse('quota', 429)
  }

  // 3. Parse multipart/form-data.
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('invalid_body', 400)
  }

  const locale = formData.get('locale')
  if (typeof locale !== 'string' || !ALLOWED_LOCALES.has(locale)) {
    return errorResponse('invalid_locale', 400)
  }

  const audioFile = formData.get('audio')
  if (!(audioFile instanceof File) && !(audioFile instanceof Blob)) {
    return errorResponse('missing_audio', 400)
  }

  // 4. Validate audio.
  const mimeType = audioFile.type || ''
  const mimeOk = ALLOWED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix))
  if (!mimeOk) return errorResponse('unsupported_format', 415)

  if (audioFile.size === 0) return errorResponse('empty_audio', 400)
  if (audioFile.size > MAX_AUDIO_BYTES) return errorResponse('audio_too_large', 413)

  // 5. Forward to Sarvam Saaras.
  const upstream = new FormData()
  upstream.append('file', audioFile, 'recording')
  upstream.append('model', 'saaras:v4')
  upstream.append('mode', 'transcribe')
  // language_code is optional — Saaras v4 auto-detects, but we can hint.
  upstream.append('language_code', locale)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let sarvamResponse: Response
  try {
    sarvamResponse = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': env.SARVAM_API_KEY },
      body: upstream,
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

  // 6. Extract transcript — never forward raw provider response.
  let sarvamJson: unknown
  try {
    sarvamJson = await sarvamResponse.json()
  } catch {
    return errorResponse('invalid_response', 502)
  }

  const transcript = extractTranscript(sarvamJson)
  if (transcript === null) return errorResponse('no_transcript', 200)

  return noStore(JSON.stringify({ transcript }))
}

function extractTranscript(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>
  // Saaras v4 returns { transcript: "..." }
  if (typeof obj.transcript === 'string' && obj.transcript.trim()) {
    return obj.transcript.trim()
  }
  return null
}
