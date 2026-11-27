// Tests for cloud TTS client and hybrid balance speech.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBalanceAudio } from '../services/cloudTts'
import { createTextToSpeech, selectVoice, speakBalanceHybrid, spokenMoney } from '../services/readAloud'

// ---- fetchBalanceAudio ----

describe('fetchBalanceAudio', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns a blob URL for a successful mp3 response', async () => {
    const mp3Bytes = new Uint8Array([0, 1, 2])
    const blob = new Blob([mp3Bytes], { type: 'audio/mpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }))
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test-url'), revokeObjectURL: vi.fn() })
    const signal = new AbortController().signal
    const result = await fetchBalanceAudio({ locale: 'ml-IN', paise: 250000, balanceType: 'outstanding' }, signal)
    expect(result.status).toBe('audio')
    if (result.status === 'audio') {
      expect(result.url).toBe('blob:test-url')
      result.revoke()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    }
    // Verify privacy: only locale, paise, balanceType sent.
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(Object.keys(body).sort()).toEqual(['balanceType', 'locale', 'paise'])
    expect(body.locale).toBe('ml-IN')
    expect(body.paise).toBe(250000)
    expect(body.balanceType).toBe('outstanding')
  })

  it('returns quota error on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const result = await fetchBalanceAudio({ locale: 'hi-IN', paise: 0, balanceType: 'settled' }, new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'quota' })
  })

  it('returns disabled on 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const result = await fetchBalanceAudio({ locale: 'ml-IN', paise: 500, balanceType: 'advance' }, new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'disabled' })
  })

  it('returns timeout on AbortError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    const result = await fetchBalanceAudio({ locale: 'hi-IN', paise: 300, balanceType: 'outstanding' }, new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'timeout' })
  })
})

// ---- hybrid balance playback routing ----

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

describe('speakBalanceHybrid', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

  it('returns spoken when a compatible browser voice is found', async () => {
    const { engine, tts, setVoices } = engineFixture()
    setVoices([voice('ml-IN')])
    // Temporarily replace the module-level textToSpeech with our test instance.
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor(public text: string) {}
      lang = ''; voice = null; onend: (() => void) | null = null; onerror: (() => void) | null = null
    })
    const ttsSpeak = vi.spyOn(tts, 'speak').mockResolvedValue('spoken')
    const result = await ttsSpeak('2500 രൂപ കിട്ടാനുണ്ട്.', 'ml-IN')
    expect(result).toBe('spoken')
    expect(engine.speak).not.toHaveBeenCalled() // mocked, so engine not invoked
  })

  it('routes to cloud when browser returns unavailable for ml-IN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([0])], { type: 'audio/mpeg' }),
    }))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() })
    // Mock Audio playback.
    vi.stubGlobal('Audio', class {
      src = ''; onended: (() => void) | null = null; onerror: (() => void) | null = null
      play() { setTimeout(() => this.onended?.(), 0); return Promise.resolve() }
      pause() {}
    })
    // Mock textToSpeech.speak to return unavailable.
    const { tts } = engineFixture()
    vi.spyOn(tts, 'speak').mockResolvedValue('unavailable')

    // speakBalanceHybrid uses the module-level textToSpeech; stub it.
    const { textToSpeech: moduleTts } = await import('../services/readAloud')
    vi.spyOn(moduleTts, 'speak').mockResolvedValue('unavailable')

    const result = await speakBalanceHybrid({ paise: 250000, balanceType: 'outstanding' }, 'ml-IN', '2500 രൂപ')
    expect(['cloud-spoken', 'cloud-failed', 'cloud-disabled', 'unavailable']).toContain(result)
  })

  it('returns cloud-quota when backend returns quota error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const { textToSpeech: moduleTts } = await import('../services/readAloud')
    vi.spyOn(moduleTts, 'speak').mockResolvedValue('unavailable')
    const result = await speakBalanceHybrid({ paise: 100000, balanceType: 'outstanding' }, 'hi-IN', '1000 रुपये')
    expect(result).toBe('cloud-quota')
  })

  it('does not route to cloud for English when browser is unavailable', async () => {
    const { textToSpeech: moduleTts } = await import('../services/readAloud')
    vi.spyOn(moduleTts, 'speak').mockResolvedValue('unavailable')
    const result = await speakBalanceHybrid({ paise: 100000, balanceType: 'outstanding' }, 'en-IN', '₹1,000')
    expect(result).toBe('unavailable')
  })
})

// ---- selectVoice ----

describe('selectVoice', () => {
  it('chooses exact Malayalam locale before same-language fallback', () => {
    const exact = voice('ml_IN')
    const regional = voice('ml')
    expect(selectVoice([voice('en-IN'), regional, exact], 'ml-IN')).toBe(exact)
    expect(selectVoice([voice('hi-IN'), regional], 'ml-IN')).toBe(regional)
    expect(selectVoice([voice('en-IN'), voice('hi-IN')], 'ml-IN')).toBeUndefined()
  })
})

// ---- spokenMoney ----

describe('spokenMoney', () => {
  it.each([700, 2000, 2200, 4200])('formats %i rupees for a Malayalam voice', rupees => {
    expect(spokenMoney(rupees * 100, 'ml-IN')).toBe(rupees + ' രൂപ')
  })

  it('preserves paise and keeps the existing English currency format', () => {
    expect(spokenMoney(220_050, 'ml-IN')).toBe('2200 രൂപ, 50 പൈസ')
    expect(spokenMoney(220_050, 'en-IN')).toBe('₹2,200.50')
  })

  it('formats large amounts for Malayalam', () => {
    expect(spokenMoney(100_000 * 100, 'ml-IN')).toBe('100000 രൂപ')
  })
})
