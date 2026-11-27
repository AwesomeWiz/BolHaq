import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { speechToText } from '../services/speech'

class BrowserRecognition {
  static current: BrowserRecognition
  lang = ''
  onstart?: () => void
  onaudiostart?: () => void
  onaudioend?: () => void
  onsoundstart?: () => void
  onsoundend?: () => void
  onend?: () => void
  onresult?: (event: { results: { transcript: string }[][] }) => void
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()

  constructor() { BrowserRecognition.current = this }
}

function callbacks() {
  return { started: vi.fn(), sound: vi.fn(), processing: vi.fn(), recognized: vi.fn(), failed: vi.fn() }
}

beforeEach(() => vi.stubGlobal('window', { SpeechRecognition: BrowserRecognition }))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('uses browser listening and sound events, processes stop once, and returns one final transcript', () => {
  const events = callbacks()
  const controls = speechToText.listen('ml-IN', events)
  const recognition = BrowserRecognition.current
  expect(recognition.lang).toBe('ml-IN')
  expect(recognition.start).toHaveBeenCalledOnce()
  expect(events.started).not.toHaveBeenCalled()
  recognition.onstart?.()
  recognition.onaudiostart?.()
  expect(events.started).toHaveBeenCalledOnce()
  recognition.onsoundstart?.()
  recognition.onsoundend?.()
  expect(events.sound.mock.calls).toEqual([[true], [false]])
  controls.stop()
  expect(recognition.stop).toHaveBeenCalledOnce()
  recognition.onaudioend?.()
  expect(events.processing).toHaveBeenCalledOnce()
  recognition.onresult?.({ results: [[{ transcript: '  ഞാൻ ഇന്ന് ജോലി ചെയ്തു. ' }]] })
  recognition.onend?.()
  expect(events.recognized).toHaveBeenCalledExactlyOnceWith('ഞാൻ ഇന്ന് ജോലി ചെയ്തു.')
  expect(events.failed).not.toHaveBeenCalled()
})

it('aborts and clears timeout without reporting a transcript when cancelled', async () => {
  vi.useFakeTimers()
  const events = callbacks()
  const controls = speechToText.listen('en-IN', events)
  const recognition = BrowserRecognition.current
  controls.cancel()
  expect(recognition.abort).toHaveBeenCalledOnce()
  recognition.onresult?.({ results: [[{ transcript: 'I received 2000 rupees.' }]] })
  recognition.onend?.()
  await vi.advanceTimersByTimeAsync(12_000)
  expect(events.recognized).not.toHaveBeenCalled()
  expect(events.failed).not.toHaveBeenCalled()
})
