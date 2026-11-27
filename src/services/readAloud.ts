import { money } from '../locales'
import type { Locale } from '../locales'
import { fetchBalanceAudio, playAudioUrl } from './cloudTts'
import type { BalanceType } from './cloudTts'

export type PlaybackResult = 'spoken' | 'unavailable' | 'failed' | 'cancelled'

export interface TextToSpeechProvider {
  prime(): void
  speak(text: string, locale: Locale): Promise<PlaybackResult>
  cancel(): void
}

function languageTag(tag: string) {
  return tag.trim().replaceAll('_', '-').toLowerCase()
}

export function selectVoice<T extends { lang: string }>(voices: readonly T[], locale: Locale) {
  const preferred = languageTag(locale)
  const language = preferred.split('-')[0]
  return voices.find(voice => languageTag(voice.lang) === preferred) ??
    voices.find(voice => languageTag(voice.lang).split('-')[0] === language)
}

export function spokenMoney(paise: number, locale: Locale) {
  if (locale !== 'ml-IN') return money(paise, locale)
  // Give the Malayalam voice currency words and plain digits rather than a
  // currency symbol and Indian grouping punctuation.
  const rupees = Math.floor(paise / 100)
  const cents = paise % 100
  return cents ? `${rupees} രൂപ, ${cents} പൈസ` : `${rupees} രൂപ`
}

type SpeechEngine = Pick<SpeechSynthesis, 'getVoices' | 'addEventListener' | 'removeEventListener' | 'speak' | 'cancel'>

export function createTextToSpeech(
  engine: () => SpeechEngine | undefined,
  createUtterance: (text: string) => SpeechSynthesisUtterance,
  voiceWaitMs = 1400,
): TextToSpeechProvider {
  let cancelPending: (() => void) | undefined

  return {
    prime() {
      try { engine()?.getVoices() } catch { /* A later read-aloud request reports an unavailable engine. */ }
    },
    speak(text, locale) {
      cancelPending?.()
      const synthesis = engine()
      if (!synthesis) return Promise.resolve('unavailable')

      return new Promise(resolve => {
        let complete = false
        let speaking = false
        let utterance: SpeechSynthesisUtterance | undefined
        let timeout: ReturnType<typeof setTimeout> | undefined

        function stopWaiting() {
          clearTimeout(timeout)
          synthesis?.removeEventListener('voiceschanged', tryVoice)
        }

        function finish(result: PlaybackResult) {
          if (complete) return
          complete = true
          cancelPending = undefined
          stopWaiting()
          if (utterance) {
            utterance.onend = null
            utterance.onerror = null
          }
          resolve(result)
        }

        function tryVoice() {
          if (!synthesis || complete || speaking) return
          try {
            const voice = selectVoice(synthesis.getVoices(), locale)
            if (!voice) return
            stopWaiting()
            utterance = createUtterance(text)
            utterance.lang = locale
            utterance.voice = voice
            utterance.onend = () => finish('spoken')
            utterance.onerror = ({ error }) => finish(error === 'language-unavailable' || error === 'voice-unavailable'
              ? 'unavailable' : 'failed')
            speaking = true
            timeout = setTimeout(() => {
              finish('failed')
              synthesis.cancel()
            }, 15_000)
            synthesis.speak(utterance)
          } catch {
            finish('failed')
          }
        }

        cancelPending = () => {
          finish('cancelled')
          if (speaking) synthesis.cancel()
        }
        timeout = setTimeout(() => {
          tryVoice()
          if (!speaking) finish('unavailable')
        }, voiceWaitMs)
        synthesis.addEventListener('voiceschanged', tryVoice)
        tryVoice()
      })
    },
    cancel() { cancelPending?.() },
  }
}

export const textToSpeech = createTextToSpeech(
  () => typeof SpeechSynthesisUtterance === 'undefined' ? undefined : window.speechSynthesis,
  text => new SpeechSynthesisUtterance(text),
)

// ---------------------------------------------------------------------------
// Hybrid TTS: browser first, Bulbul cloud fallback
// ---------------------------------------------------------------------------

export type HybridPlayResult = PlaybackResult | 'cloud-spoken' | 'cloud-quota' | 'cloud-disabled' | 'cloud-failed'

export interface BalancePlayRequest {
  paise: number
  balanceType: BalanceType
}

let cloudAbortController: AbortController | undefined

export function cancelCloudTts() {
  cloudAbortController?.abort()
  cloudAbortController = undefined
}

/**
 * Speak a wage balance in the given locale.
 * 1. Try browser SpeechSynthesis.
 * 2. If unavailable/failed and locale is hi-IN or ml-IN, try Bulbul via backend.
 * 3. Cancel any in-flight cloud request when called again.
 */
export async function speakBalanceHybrid(
  request: BalancePlayRequest,
  locale: Locale,
  spokenText: string,
): Promise<HybridPlayResult> {
  // Cancel any previous cloud TTS.
  cancelCloudTts()

  // 1. Browser TTS attempt.
  const browserResult = await textToSpeech.speak(spokenText, locale)
  if (browserResult === 'spoken' || browserResult === 'cancelled') return browserResult

  // 2. Cloud fallback only for hi-IN / ml-IN.
  if (locale !== 'hi-IN' && locale !== 'ml-IN') {
    return browserResult === 'unavailable' ? 'unavailable' : 'failed'
  }

  // 3. Try Bulbul.
  const controller = new AbortController()
  cloudAbortController = controller

  const cloudResult = await fetchBalanceAudio(
    { locale, paise: request.paise, balanceType: request.balanceType },
    controller.signal,
  )

  if (controller.signal.aborted) return 'cancelled'
  cloudAbortController = undefined

  if (cloudResult.status === 'error') {
    const code = cloudResult.code
    if (code === 'quota') return 'cloud-quota'
    if (code === 'disabled') return 'cloud-disabled'
    return 'cloud-failed'
  }

  // Play the returned audio blob URL.
  const played = await playAudioUrl(cloudResult.url, controller.signal)
  cloudResult.revoke()
  if (played === 'spoken') return 'cloud-spoken'
  if (played === 'cancelled') return 'cancelled'
  return 'cloud-failed'
}
