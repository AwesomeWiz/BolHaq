// Tests for cloud speech-to-text client and routing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloudSpeechAvailable, supportedMimeType, transcribeBlob } from '../services/cloudSpeech'

// ---- supportedMimeType / cloudSpeechAvailable ----

describe('supportedMimeType', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns undefined when MediaRecorder is not available', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(supportedMimeType()).toBeUndefined()
    expect(cloudSpeechAvailable()).toBe(false)
  })

  it('returns the first supported MIME type', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (mime: string) => mime === 'audio/webm;codecs=opus',
    })
    expect(supportedMimeType()).toBe('audio/webm;codecs=opus')
    expect(cloudSpeechAvailable()).toBe(true)
  })

  it('prefers audio/mp4 over webm when both are supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    expect(supportedMimeType()).toBe('audio/mp4')
  })

  it('returns undefined when no format is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(supportedMimeType()).toBeUndefined()
  })
})

// ---- transcribeBlob ----

describe('transcribeBlob', () => {
  const blob = new Blob(['audio'], { type: 'audio/webm' })

  afterEach(() => vi.restoreAllMocks())

  it('returns a transcript on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: 'मुझे 500 रुपये मिले' }),
    }))
    const signal = new AbortController().signal
    const result = await transcribeBlob(blob, 'hi-IN', signal)
    expect(result).toEqual({ status: 'transcript', text: 'मुझे 500 रुपये मिले' })
    // Verify locale is passed in form data.
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = fetchCall[1]?.body as FormData
    expect(body.get('locale')).toBe('hi-IN')
  })

  it('returns quota error on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const result = await transcribeBlob(blob, 'ml-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'quota' })
  })

  it('returns disabled error on 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const result = await transcribeBlob(blob, 'hi-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'disabled' })
  })

  it('returns timeout when AbortError is thrown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    const result = await transcribeBlob(blob, 'hi-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'timeout' })
  })

  it('returns network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await transcribeBlob(blob, 'hi-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'network' })
  })

  it('returns format error on 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))
    const result = await transcribeBlob(blob, 'hi-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'format' })
  })

  it('returns server error on malformed provider response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'field' }),
    }))
    const result = await transcribeBlob(blob, 'hi-IN', new AbortController().signal)
    expect(result).toEqual({ status: 'error', code: 'server' })
  })
})
