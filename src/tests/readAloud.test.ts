import { afterEach, expect, it, vi } from 'vitest'
import { createTextToSpeech, selectVoice, spokenMoney } from '../services/readAloud'

function voice(lang: string): SpeechSynthesisVoice {
  return { lang, name: lang, voiceURI: lang, default: false, localService: true }
}

function engineFixture() {
  let voices: SpeechSynthesisVoice[] = []
  const engine = Object.assign(new EventTarget(), {
    getVoices: vi.fn(() => voices),
    speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
    cancel: vi.fn(),
  })
  const tts = createTextToSpeech(() => engine, text => ({ text } as SpeechSynthesisUtterance), 120)
  return { engine, tts, setVoices(next: SpeechSynthesisVoice[]) {
    voices = next
    engine.dispatchEvent(new Event('voiceschanged'))
  } }
}

it('chooses exact Malayalam locale before same-language fallback', () => {
  const exact = voice('ml_IN')
  const regional = voice('ml')
  expect(selectVoice([voice('en-IN'), regional, exact], 'ml-IN')).toBe(exact)
  expect(selectVoice([voice('hi-IN'), regional], 'ml-IN')).toBe(regional)
  expect(selectVoice([voice('en-IN'), voice('hi-IN')], 'ml-IN')).toBeUndefined()
})

it('waits for asynchronous voices and sends a Malayalam utterance', async () => {
  const { engine, tts, setVoices } = engineFixture()
  const ml = voice('ml-IN')
  setVoices([voice('en-IN')])
  tts.prime()
  const request = tts.speak('കിട്ടാനുള്ള കൂലി 2200 രൂപ.', 'ml-IN')
  expect(engine.speak).not.toHaveBeenCalled()
  setVoices([voice('en-IN'), ml])
  const [utterance] = engine.speak.mock.calls[0]
  expect(utterance).toMatchObject({ voice: ml, lang: 'ml-IN', text: 'കിട്ടാനുള്ള കൂലി 2200 രൂപ.' })
  utterance.onend?.(new Event('end') as SpeechSynthesisEvent)
  await expect(request).resolves.toBe('spoken')
})

it('returns an unavailable result without substituting a different language', async () => {
  vi.useFakeTimers()
  const { engine, tts, setVoices } = engineFixture()
  setVoices([voice('hi-IN'), voice('en-IN')])
  const request = tts.speak('700 രൂപ', 'ml-IN')
  await vi.advanceTimersByTimeAsync(120)
  await expect(request).resolves.toBe('unavailable')
  expect(engine.speak).not.toHaveBeenCalled()
})

it('distinguishes a synthesis error from unavailable voices', async () => {
  const { engine, tts, setVoices } = engineFixture()
  setVoices([voice('ml-IN')])
  const request = tts.speak('700 രൂപ', 'ml-IN')
  engine.speak.mock.calls[0][0].onerror?.({ error: 'audio-hardware' } as SpeechSynthesisErrorEvent)
  await expect(request).resolves.toBe('failed')
})

it('cancels pending voice selection before changing language or starting recognition', async () => {
  const { engine, tts, setVoices } = engineFixture()
  const request = tts.speak('700 രൂപ', 'ml-IN')
  tts.cancel()
  setVoices([voice('ml-IN')])
  await expect(request).resolves.toBe('cancelled')
  expect(engine.speak).not.toHaveBeenCalled()
})

it.each([700, 2000, 2200, 4200])('formats %i rupees for a Malayalam voice', rupees => {
  expect(spokenMoney(rupees * 100, 'ml-IN')).toBe(rupees + ' രൂപ')
})
it('preserves paise and keeps the existing English currency format', () => {
  expect(spokenMoney(220_050, 'ml-IN')).toBe('2200 രൂപ, 50 പൈസ')
  expect(spokenMoney(220_050, 'en-IN')).toBe('₹2,200.50')
})

afterEach(() => vi.useRealTimers())
