// Cloud text-to-speech client using the BolHaq backend proxy.
// No Sarvam credentials are present in this file.

export type CloudTtsLocale = 'hi-IN' | 'ml-IN'
export type BalanceType = 'outstanding' | 'advance' | 'settled'

export type CloudTtsResult =
  | { status: 'audio'; url: string; revoke(): void }
  | { status: 'error'; code: 'quota' | 'disabled' | 'timeout' | 'server' | 'network' | 'invalid' }

const BALANCE_ENDPOINT = '/api/speech/balance'

export interface BalanceRequest {
  locale: CloudTtsLocale
  paise: number        // integer paise, always non-negative
  balanceType: BalanceType
}

export async function fetchBalanceAudio(
  request: BalanceRequest,
  signal: AbortSignal,
): Promise<CloudTtsResult> {
  try {
    const response = await fetch(BALANCE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: request.locale,
        paise: request.paise,
        balanceType: request.balanceType,
      }),
      signal,
    })

    if (!response.ok) {
      return { status: 'error', code: errorCodeFromStatus(response.status) }
    }

    const blob = await response.blob()
    if (!blob.size) return { status: 'error', code: 'server' }

    const url = URL.createObjectURL(blob)
    return { status: 'audio', url, revoke: () => URL.revokeObjectURL(url) }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', code: 'timeout' }
    }
    return { status: 'error', code: 'network' }
  }
}

function errorCodeFromStatus(status: number): Exclude<CloudTtsResult, { status: 'audio' }>['code'] {
  if (status === 429) return 'quota'
  if (status === 503 || status === 404) return 'disabled'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 400) return 'invalid'
  return 'server'
}

// Plays a fetched audio URL through an HTMLAudioElement with iOS restrictions in mind.
// Returns 'spoken' | 'failed' | 'cancelled'.
export type PlayResult = 'spoken' | 'failed' | 'cancelled'

export function playAudioUrl(
  url: string,
  signal: AbortSignal,
): Promise<PlayResult> {
  return new Promise(resolve => {
    const audio = new Audio(url)
    let settled = false

    function finish(result: PlayResult) {
      if (settled) return
      settled = true
      audio.onended = null
      audio.onerror = null
      resolve(result)
    }

    const onAbort = () => {
      audio.pause()
      finish('cancelled')
    }
    signal.addEventListener('abort', onAbort, { once: true })

    audio.onended = () => finish('spoken')
    audio.onerror = () => finish('failed')

    audio.play().catch(() => finish('failed'))
  })
}
