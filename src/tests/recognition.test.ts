import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSpeechDiagnostics, speechDiagnosticSnapshot } from '../services/speechDiagnostics'
import { speechToText } from '../services/speech'

class BrowserRecognition {
  static current: BrowserRecognition
  static startError?: DOMException
  lang = ''
  onstart?: () => void
  onaudiostart?: () => void
  onaudioend?: () => void
  onsoundstart?: () => void
  onsoundend?: () => void
  onspeechstart?: () => void
  onnomatch?: () => void
  onend?: () => void
  onerror?: (event: { error: string; message?: string }) => void
  onresult?: (event: { resultIndex?: number; results: ({ transcript: string }[] & { isFinal?: boolean })[] }) => void
  start = vi.fn(() => { if (BrowserRecognition.startError) throw BrowserRecognition.startError })
  stop = vi.fn()
  abort = vi.fn()

  constructor() { BrowserRecognition.current = this }
}

function callbacks() {
  return { started: vi.fn(), sound: vi.fn(), processing: vi.fn(), recognized: vi.fn(), failed: vi.fn() }
}

beforeEach(() => vi.stubGlobal('window', { SpeechRecognition: BrowserRecognition }))
afterEach(() => {
  speechToText.cancel()
  BrowserRecognition.startError = undefined
  clearSpeechDiagnostics()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

it.each([
  ['not-allowed', 'denied'], ['no-speech', 'emptySpeech'], ['aborted', 'speechInterrupted'],
  ['language-not-supported', 'speechLanguage'], ['service-not-allowed', 'speechUnavailable'],
  ['network', 'speechUnavailable'], ['audio-capture', 'speechCapture'], ['unexpected-code', 'speechError'],
])(
  'reports %s and permits a new session', (reason, issue) => {
    const failed = callbacks()
    speechToText.listen('en-IN', failed)
    BrowserRecognition.current.onerror?.({ error: reason })
    expect(failed.failed).toHaveBeenCalledExactlyOnceWith(issue)
    expect(failed.recognized).not.toHaveBeenCalled()
    const retry = callbacks()
    speechToText.listen('en-IN', retry)
    BrowserRecognition.current.onresult?.({ results: [[{ transcript: 'I worked today.' }]] })
    expect(retry.recognized).toHaveBeenCalledExactlyOnceWith('I worked today.')
  },
)

it('times out and aborts a stalled session', async () => {
  vi.useFakeTimers()
  const events = callbacks()
  speechToText.listen('en-IN', events)
  await vi.advanceTimersByTimeAsync(12_000)
  expect(BrowserRecognition.current.abort).toHaveBeenCalledOnce()
  expect(events.failed).toHaveBeenCalledExactlyOnceWith('timeout')
})

it('reports unsupported recognition asynchronously', async () => {
  vi.stubGlobal('window', {})
  const events = callbacks()
  expect(speechToText.available()).toBe(false)
  speechToText.listen('en-IN', events)
  await Promise.resolve()
  expect(events.failed).toHaveBeenCalledExactlyOnceWith('unsupported')
})

it('uses the prefixed API and releases old sessions during rapid locale changes', () => {
  vi.stubGlobal('window', { webkitSpeechRecognition: BrowserRecognition })
  const first = callbacks()
  speechToText.listen('en-IN', first)
  const english = BrowserRecognition.current
  const oldResult = english.onresult
  expect(english.lang).toBe('en-IN')

  speechToText.listen('hi-IN', callbacks())
  const hindi = BrowserRecognition.current
  expect(hindi.lang).toBe('hi-IN')
  expect(english.abort).toHaveBeenCalledOnce()
  expect(english.onstart).toBeNull()
  expect(english.onresult).toBeNull()
  expect(english.onerror).toBeNull()
  oldResult?.({ results: [[{ transcript: 'I received 300 rupees' }]] })
  expect(first.recognized).not.toHaveBeenCalled()

  const third = callbacks()
  speechToText.listen('ml-IN', third)
  expect(hindi.abort).toHaveBeenCalledOnce()
  expect(BrowserRecognition.current.lang).toBe('ml-IN')
  BrowserRecognition.current.onresult?.({ results: [[{ transcript: 'ഇന്ന് പണിക്ക് പോയി' }]] })
  BrowserRecognition.current.onend?.()
  expect(third.recognized).toHaveBeenCalledExactlyOnceWith('ഇന്ന് പണിക്ക് പോയി')
})

it('cleans up a synchronous start failure and accepts a new attempt', async () => {
  BrowserRecognition.startError = new DOMException('Unable to start', 'InvalidStateError')
  const events = callbacks()
  speechToText.listen('hi-IN', events)
  const failed = BrowserRecognition.current
  await Promise.resolve()
  expect(events.failed).toHaveBeenCalledExactlyOnceWith('speechError')
  expect(failed.abort).toHaveBeenCalledOnce()
  expect(failed.onend).toBeNull()
  BrowserRecognition.startError = undefined
  speechToText.listen('hi-IN', events)
  BrowserRecognition.current.onstart?.()
  expect(events.started).toHaveBeenCalledOnce()
})

it('keeps opt-in lifecycle metadata including raw error and end without recording transcript text', () => {
  const privateText = 'private worksite paid me 1234'
  const events = callbacks()
  speechToText.listen('ml-IN', events)
  expect(speechDiagnosticSnapshot()).toEqual([])
  vi.stubGlobal('window', { webkitSpeechRecognition: BrowserRecognition, location: { search: '?speech-debug=1' } })
  speechToText.listen('hi-IN', events)
  const browser = BrowserRecognition.current
  browser.onstart?.()
  browser.onaudiostart?.()
  browser.onsoundstart?.()
  browser.onspeechstart?.()
  browser.onresult?.({ results: [Object.assign([{ transcript: privateText }], { isFinal: false })] })
  expect(events.recognized).not.toHaveBeenCalled()
  browser.onerror?.({ error: 'service-not-allowed', message: 'Service unavailable in this browser' })
  browser.onend?.()
  const trace = speechDiagnosticSnapshot().filter(entry => entry.requestedLocale === 'hi-IN')
  expect(trace.map(entry => entry.event)).toEqual([
    'request', 'start', 'audiostart', 'soundstart', 'speechstart', 'result', 'error', 'end', 'close',
  ])
  expect(trace[5]).toMatchObject({ transcriptReturned: true, api: 'webkit', interfaceLocale: 'hi-IN' })
  expect(trace[6]).toMatchObject({ errorCode: 'service-not-allowed', errorMessage: 'Service unavailable in this browser' })
  expect(JSON.stringify(trace)).not.toContain(privateText)

  speechToText.listen('ml-IN', events)
  BrowserRecognition.current.onnomatch?.()
  BrowserRecognition.current.onend?.()
  expect(speechDiagnosticSnapshot()).toContainEqual(expect.objectContaining({ event: 'nomatch', transcriptReturned: false }))
  expect(events.failed.mock.calls).toEqual([['speechUnavailable'], ['emptySpeech']])
})

it('takes the final transcript at the result index and discards stale and interim entries', () => {
  const events = callbacks()
  speechToText.listen('en-IN', events)
  BrowserRecognition.current.onresult?.({ resultIndex: 1, results: [
    [{ transcript: 'old result' }],
    Object.assign([{ transcript: 'final transcript' }], { isFinal: true }),
    Object.assign([{ transcript: 'interim result' }], { isFinal: false }),
  ] })
  expect(events.recognized).toHaveBeenCalledExactlyOnceWith('final transcript')
})
