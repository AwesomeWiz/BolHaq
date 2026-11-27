import type { Locale } from '../locales'
import type { TourStep } from '../locales/onboarding'
import { textToSpeech } from './readAloud'
import type { PlaybackResult, TextToSpeechProvider } from './readAloud'

type Recordings = Partial<Record<Locale, Partial<Record<TourStep, string>>>>
// Register real filenames from public/audio/onboarding/<locale>/ as recordings become available.
const recordings: Recordings = {}

type AudioPlayer = Pick<HTMLAudioElement, 'play' | 'pause' | 'onended' | 'onerror'>

export function createTourNarration(
  speech: Pick<TextToSpeechProvider, 'speak' | 'cancel'>,
  files: Recordings,
  createAudio: (path: string) => AudioPlayer,
) {
  let pending: { cancel(): void } | undefined
  const localAudioNeeded = new Set<Locale>()

  return {
    cancel() { pending?.cancel() },
    play(step: TourStep, locale: Locale, text: string): Promise<PlaybackResult> {
      pending?.cancel()
      return new Promise(resolve => {
        let audio: AudioPlayer | undefined
        let usingSynthesis = true
        const session = { cancel }
        pending = session

        function finish(result: PlaybackResult) {
          if (pending !== session) return
          pending = undefined
          if (audio) audio.onended = audio.onerror = null
          resolve(result)
        }

        function cancel() {
          finish('cancelled')
          if (usingSynthesis) speech.cancel()
          else audio?.pause()
        }

        // Call synthesis during the user's navigation gesture when a compatible voice is ready.
        void (async () => {
          try {
            const file = files[locale]?.[step]
            if (!file || !localAudioNeeded.has(locale)) {
              const result = await speech.speak(text, locale)
              if (pending !== session) return
              if (result !== 'unavailable' || !file) { finish(result); return }
              // A later replay can invoke play directly from the tap if the fallback was blocked.
              localAudioNeeded.add(locale)
            }
            usingSynthesis = false
            audio = createAudio(`${import.meta.env.BASE_URL}audio/onboarding/${locale}/${file}`)
            audio.onended = () => finish('spoken')
            audio.onerror = () => finish('failed')
            await audio.play()
          } catch {
            finish('failed')
          }
        })()
      })
    },
  }
}

export const tourNarration = createTourNarration(textToSpeech, recordings, path => new Audio(path))
