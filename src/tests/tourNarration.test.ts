import { expect, it, vi } from 'vitest'
import { createTourNarration } from '../services/tourNarration'

function setup() {
  const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), onended: null, onerror: null }
  const createAudio = vi.fn().mockReturnValue(audio)
  const speech = { speak: vi.fn().mockResolvedValue('unavailable'), cancel: vi.fn() }
  const tour = createTourNarration(speech, { 'ml-IN': { mic: 'mic.mp3' } }, createAudio)
  return { tour, speech, audio, createAudio }
}

it('uses matching synthesis first and skips packaged audio lookup when no asset is registered', async () => {
  const { tour, speech, createAudio } = setup()
  speech.speak.mockResolvedValueOnce('spoken')
  expect(await tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')).toBe('spoken')
  expect(speech.speak).toHaveBeenCalledExactlyOnceWith('നിർദ്ദേശം', 'ml-IN')
  expect(await tour.play('mic', 'hi-IN', 'निर्देश')).toBe('unavailable')
  expect(createAudio).not.toHaveBeenCalled()
})

it('plays the registered local fallback and detaches and pauses it on step changes', async () => {
  const { tour, audio, createAudio } = setup()
  const pending = tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')
  await Promise.resolve()
  expect(createAudio).toHaveBeenCalledExactlyOnceWith('/audio/onboarding/ml-IN/mic.mp3')
  expect(audio.play).toHaveBeenCalledOnce()
  const lateEnd = audio.onended as (() => void) | null
  const next = tour.play('site', 'ml-IN', 'സ്ഥലം')
  expect(audio.pause).toHaveBeenCalledOnce()
  expect(audio.onended).toBeNull()
  lateEnd?.()
  expect(await pending).toBe('cancelled')
  expect(await next).toBe('unavailable')
})

it('allows an explicit replay to start fallback playback immediately after a rejected play request', async () => {
  const { tour, audio } = setup()
  audio.play.mockRejectedValueOnce(new DOMException('Playback blocked', 'NotAllowedError'))
  expect(await tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')).toBe('failed')
  const replay = tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')
  expect(audio.play).toHaveBeenCalledTimes(2)
  const ended = audio.onended as (() => void) | null
  ended?.()
  expect(await replay).toBe('spoken')
})

it('invalidates a pending synthesis attempt without starting a late fallback', async () => {
  const { tour, speech, createAudio } = setup()
  let release: (value: string) => void = () => {}
  speech.speak.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const result = tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')
  tour.cancel()
  release('unavailable')
  expect(await result).toBe('cancelled')
  expect(speech.cancel).toHaveBeenCalledOnce()
  expect(createAudio).not.toHaveBeenCalled()
})
