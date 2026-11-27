// Tests for Malayalam onboarding narration and fixed-step audio playback.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTourNarration } from '../services/tourNarration'

describe('Malayalam tour narration fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls cloud narration endpoint for ml-IN when browser synthesis is unavailable', async () => {
    let audioEnded: (() => void) | null = null
    const audio = {
      play: vi.fn().mockImplementation(function () {
        setTimeout(() => audioEnded?.(), 0)
        return Promise.resolve()
      }),
      pause: vi.fn(),
      get onended() { return audioEnded },
      set onended(fn: (() => void) | null) { audioEnded = fn },
      onerror: null,
    }
    const createAudio = vi.fn().mockReturnValue(audio)
    const speech = { speak: vi.fn().mockResolvedValue('unavailable'), cancel: vi.fn() }

    const fakeBlob = new Blob(['mp3-audio'], { type: 'audio/mpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    }))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:narration-audio'),
      revokeObjectURL: vi.fn(),
    })

    const tour = createTourNarration(speech, {}, createAudio)
    const result = await tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')

    expect(fetch).toHaveBeenCalledWith('/api/speech/narration', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ step: 'mic', locale: 'ml-IN' }),
    }))
    expect(createAudio).toHaveBeenCalledWith('blob:narration-audio')
    expect(audio.play).toHaveBeenCalledOnce()
    expect(result).toBe('spoken')
  })

  it('stops and cancels cloud narration when step changes', async () => {
    const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), onended: null, onerror: null }
    const createAudio = vi.fn().mockReturnValue(audio)
    const speech = { speak: vi.fn().mockResolvedValue('unavailable'), cancel: vi.fn() }

    const fakeBlob = new Blob(['mp3-audio'], { type: 'audio/mpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    }))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:narration-audio'),
      revokeObjectURL: vi.fn(),
    })

    const tour = createTourNarration(speech, {}, createAudio)
    const first = tour.play('mic', 'ml-IN', 'നിർദ്ദേശം')
    await Promise.resolve()

    // Cancel / change step
    tour.cancel()
    expect(await first).toBe('cancelled')
  })
})
