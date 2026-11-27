import type { Locale } from '../locales'
import type { TourStep } from '../locales/onboarding'
import { textToSpeech } from './readAloud'
import type { PlaybackResult, TextToSpeechProvider } from './readAloud'

type Recordings = Partial<Record<Locale, Partial<Record<TourStep, string>>>>
// Register real filenames from public/audio/onboarding/<locale>/ as recordings become available.
const recordings: Recordings = {}

type AudioPlayer = Pick<HTMLAudioElement, 'play' | 'pause' | 'onended' | 'onerror'>

export async function fetchNarrationAudio(step: TourStep, locale: Locale, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch('/api/speech/narration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, locale }),
      signal,
    })
    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.size) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export function createTourNarration(
  speech: Pick<TextToSpeechProvider, 'speak' | 'cancel'>,
  files: Recordings,
  createAudio: (path: string) => AudioPlayer,
) {
  let pending: { cancel(): void } | undefined
  const localAudioNeeded = new Set<Locale>()
  let currentObjectUrl: string | undefined

  return {
    cancel() {
      pending?.cancel()
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
        currentObjectUrl = undefined
      }
    },
    play(step: TourStep, locale: Locale, text: string): Promise<PlaybackResult> {
      pending?.cancel()
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
        currentObjectUrl = undefined
      }

      return new Promise(resolve => {
        let audio: AudioPlayer | undefined
        let usingSynthesis = true
        const controller = new AbortController()
        const session = { cancel }
        pending = session

        function finish(result: PlaybackResult) {
          if (pending !== session) return
          pending = undefined
          if (audio) audio.onended = audio.onerror = null
          resolve(result)
        }

        function cancel() {
          controller.abort()
          finish('cancelled')
          if (usingSynthesis) speech.cancel()
          else audio?.pause()
        }

        void (async () => {
          try {
            const file = files[locale]?.[step]
            // For languages with a packaged file and already verified synthesis absence, go to file
            if (!file || !localAudioNeeded.has(locale)) {
              const result = await speech.speak(text, locale)
              if (pending !== session) return
              if (result !== 'unavailable') { finish(result); return }
              localAudioNeeded.add(locale)
            }

            // If a static file is registered, play it
            if (file) {
              usingSynthesis = false
              audio = createAudio(`${import.meta.env.BASE_URL}audio/onboarding/${locale}/${file}`)
              audio.onended = () => finish('spoken')
              audio.onerror = () => finish('failed')
              await audio.play()
              return
            }

            // Cloud narration fallback for Malayalam (or Hindi if browser synthesis is unavailable)
            if (locale === 'ml-IN' || locale === 'hi-IN') {
              const audioUrl = await fetchNarrationAudio(step, locale, controller.signal)
              if (pending !== session) return
              if (audioUrl) {
                currentObjectUrl = audioUrl
                usingSynthesis = false
                audio = createAudio(audioUrl)
                audio.onended = () => {
                  URL.revokeObjectURL(audioUrl)
                  currentObjectUrl = undefined
                  finish('spoken')
                }
                audio.onerror = () => {
                  URL.revokeObjectURL(audioUrl)
                  currentObjectUrl = undefined
                  finish('failed')
                }
                await audio.play()
                return
              }
            }

            finish('unavailable')
          } catch {
            finish('failed')
          }
        })()
      })
    },
  }
}

export const tourNarration = createTourNarration(textToSpeech, recordings, path => new Audio(path))
