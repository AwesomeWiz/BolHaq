import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { speechToText } from '../services/speech'
import { clearSpeechDiagnostics, speechDiagnosticSnapshot } from '../services/speechDiagnostics'

class Recognition {
  static current: Recognition
  onstart?: () => void
  onaudiostart?: () => void
  onaudioend?: () => void
  onend?: () => void
  onerror?: (event: { error: string; message: string }) => void
  onresult?: (event: { results: ({ transcript: string }[] & { isFinal: boolean })[] }) => void
  start() { Recognition.current = this; this.onstart?.(); this.onaudiostart?.() }
  abort = vi.fn()
}

function listen() {
  const callbacks = { started: vi.fn(), sound: vi.fn(), processing: vi.fn(), recognized: vi.fn(), failed: vi.fn() }
  const controls = speechToText.listen('hi-IN', callbacks)
  return { browser: Recognition.current, callbacks, controls }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { webkitSpeechRecognition: Recognition, location: { search: '?speech-debug=1' } })
})

afterEach(() => {
  speechToText.cancel()
  clearSpeechDiagnostics()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('reports the observed Hindi no-result end without inventing a raw error', () => {
  const { browser, callbacks } = listen()
  vi.advanceTimersByTime(9_000)
  browser.onaudioend?.()
  browser.onend?.()
  expect(callbacks.failed).not.toHaveBeenCalled()
  vi.advanceTimersByTime(300)
  expect(callbacks.failed).toHaveBeenCalledExactlyOnceWith('speechNoResult')
  expect(callbacks.recognized).not.toHaveBeenCalled()
  expect(browser.abort).not.toHaveBeenCalled()
  expect(speechDiagnosticSnapshot().map(row => row.event)).toEqual(['request', 'start', 'audiostart', 'audioend', 'end', 'close'])
})

it('accepts one final result arriving just after end and discards interim text', () => {
  const { browser, callbacks } = listen()
  browser.onend?.()
  browser.onresult?.({ results: [Object.assign([{ transcript: 'interim' }], { isFinal: false })] })
  expect(callbacks.recognized).not.toHaveBeenCalled()
  vi.advanceTimersByTime(25)
  const final = { results: [Object.assign([{ transcript: 'मुझे 500 रुपये मिले' }], { isFinal: true })] }
  const deliver = browser.onresult
  deliver?.(final)
  deliver?.(final)
  vi.advanceTimersByTime(300)
  expect(callbacks.recognized).toHaveBeenCalledExactlyOnceWith('मुझे 500 रुपये मिले')
  expect(callbacks.failed).not.toHaveBeenCalled()
  expect(browser.onresult).toBeNull()
})

it('keeps a raw browser error delivered after end and cancels its fallback timer', () => {
  const { browser, callbacks } = listen()
  browser.onend?.()
  browser.onerror?.({ error: 'network', message: 'Original browser message' })
  vi.advanceTimersByTime(300)
  expect(callbacks.failed).toHaveBeenCalledExactlyOnceWith('speechUnavailable')
  expect(speechDiagnosticSnapshot()).toContainEqual(expect.objectContaining({
    event: 'error', errorCode: 'network', errorMessage: 'Original browser message',
  }))
})

it('discards a queued result when the user cancels during the end window', () => {
  const { browser, callbacks, controls } = listen()
  browser.onend?.()
  const deliver = browser.onresult
  controls.cancel()
  deliver?.({ results: [Object.assign([{ transcript: 'मुझे 500 रुपये मिले' }], { isFinal: true })] })
  vi.advanceTimersByTime(300)
  expect(callbacks.recognized).not.toHaveBeenCalled()
  expect(callbacks.failed).not.toHaveBeenCalled()
})
