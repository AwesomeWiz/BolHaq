// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { emptyLedger } from '../domain/ledger'
import { languages } from '../locales'
import { en } from '../locales/en'
import { onboarding } from '../locales/onboarding'
import { textToSpeech } from '../services/readAloud'
import { ledgerStore } from '../services/storage'
import { reportLedger } from './fixtures/reportLedger'

const m = onboarding('en-IN')
const hi = languages.find(language => language.code === 'hi-IN')!
const ml = languages.find(language => language.code === 'ml-IN')!

class BrowserRecognition {
  static current: BrowserRecognition
  lang = ''
  onstart?: () => void
  onend?: () => void
  onerror?: (event: { error: string }) => void
  onresult?: (event: { results: { transcript: string }[][] }) => void
  abort = vi.fn()
  start() { BrowserRecognition.current = this; this.onstart?.() }
}

function setup(ledger = emptyLedger()) {
  vi.stubGlobal('webkitSpeechRecognition', BrowserRecognition)
  vi.spyOn(ledgerStore, 'read').mockResolvedValue(ledger)
  const confirm = vi.spyOn(ledgerStore, 'confirm')
  const select = vi.spyOn(ledgerStore, 'select')
  const speak = vi.spyOn(textToSpeech, 'speak').mockResolvedValue('spoken')
  const cancelAudio = vi.spyOn(textToSpeech, 'cancel')
  const user = userEvent.setup()
  const app = render(<App />)
  return { confirm, select, speak, cancelAudio, user, app }
}

beforeEach(() => {
  localStorage.clear()
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  }
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('starts only on request, updates step progress, replays, navigates, and finishes without ledger writes', async () => {
  const { app, user, speak, confirm, select } = setup()
  const start = await screen.findByRole('button', { name: m.start })
  expect(speak).not.toHaveBeenCalled()
  expect(screen.queryByRole('progressbar')).toBeNull()
  await user.click(start)
  expect(screen.getByRole('progressbar', { name: 'Step 1 of 5' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: m.steps.language[0] }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: m.previous }).disabled).toBe(true)
  expect(speak).toHaveBeenCalledExactlyOnceWith(m.steps.language[1], 'en-IN')
  await user.click(screen.getByRole('button', { name: m.focusTarget }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Language: English' }))
  expect(speak).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: m.replay }))
  expect(speak).toHaveBeenLastCalledWith(m.steps.language[1], 'en-IN')
  await user.click(screen.getByRole('button', { name: m.next }))
  expect(screen.getByRole('progressbar', { name: 'Step 2 of 5' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: m.previous }))
  expect(screen.getByRole('progressbar', { name: 'Step 1 of 5' })).toBeTruthy()
  for (let step = 2; step <= 4; step++) {
    await user.click(screen.getByRole('button', { name: m.next }))
    expect(screen.getByRole('progressbar', { name: `Step ${step} of 5` })).toBeTruthy()
  }
  expect(screen.getByText(m.preview)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: m.next }))
  expect(screen.getByRole('progressbar', { name: 'Step 5 of 5' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: m.finish }))
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(localStorage.getItem('bolhaq-guide-complete')).toBe('completed')
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: en.examples })))
  expect(confirm).not.toHaveBeenCalled()
  expect(select).not.toHaveBeenCalled()
  app.unmount()
  render(<App />)
  await screen.findByRole('button', { name: en.addEmployer })
  expect(screen.queryByRole('button', { name: m.start })).toBeNull()
})

it('restarts from Help, switches languages on the same step, and allows keyboard skip', async () => {
  const { user, speak, cancelAudio } = setup(reportLedger())
  speak.mockImplementation(() => new Promise(() => {}))
  await user.click(await screen.findByRole('button', { name: en.examples }))
  await user.click(screen.getByRole('button', { name: m.restart }))
  await user.click(screen.getByRole('button', { name: 'Language: English' }))
  await user.click(screen.getByRole('option', { name: 'മലയാളം' }))
  const local = onboarding('ml-IN')
  expect(screen.getByRole('heading', { name: local.steps.language[0] })).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
  expect(screen.getByRole('button', { name: local.next })).toBeTruthy()
  expect(speak).toHaveBeenLastCalledWith(local.steps.language[1], 'ml-IN')
  expect(cancelAudio.mock.invocationCallOrder.some(order =>
    order > speak.mock.invocationCallOrder[0] && order < speak.mock.invocationCallOrder[1])).toBe(true)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(localStorage.getItem('bolhaq-guide-complete')).toBe('skipped')
  await user.click(screen.getByRole('button', { name: local.restart }))
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
})

it('preserves the current step during a worksite or payment dialog and stops narration before microphone use', async () => {
  const { user, confirm, cancelAudio, speak } = setup(reportLedger())
  speak.mockImplementation(() => new Promise(() => {}))
  await user.click(await screen.findByRole('button', { name: en.examples }))
  await user.click(screen.getByRole('button', { name: m.restart }))
  await user.click(screen.getByRole('button', { name: m.next }))
  await user.click(screen.getByRole('button', { name: en.addEmployer }))
  expect(screen.getByRole('dialog', { name: en.addEmployer })).toBeTruthy()
  expect(screen.queryByRole('progressbar')).toBeNull()
  await user.click(screen.getByRole('button', { name: en.closeDialog }))
  await screen.findByRole('progressbar', { name: 'Step 2 of 5' })
  expect(speak).toHaveBeenCalledTimes(2)
  await user.click(screen.getByRole('button', { name: m.next }))
  const cancelCount = cancelAudio.mock.calls.length
  await user.click(screen.getByRole('button', { name: en.tap }))
  expect(cancelAudio.mock.calls.length).toBeGreaterThan(cancelCount)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: m.replay }).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: m.next }))
  expect(speak).toHaveBeenCalledTimes(3)
  act(() => {
    BrowserRecognition.current.onresult?.({ results: [[{ transcript: 'I received Rs 300' }]] })
    BrowserRecognition.current.onend?.()
  })
  const dialog = screen.getByRole('dialog', { name: en.payment })
  expect(within(dialog).getByText(m.reviewNote)).toBeTruthy()
  expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.amount }).value).toBe('300')
  expect(screen.queryByText(m.preview)).toBeNull()
  await user.click(within(dialog).getByRole('button', { name: en.cancel }))
  await screen.findByText(m.preview)
  expect(confirm).not.toHaveBeenCalled()
  expect(speak).toHaveBeenCalledTimes(3)
})

it('keeps localized text and navigation when audio is unavailable, and stops replay when the page hides or unmounts', async () => {
  const { user, app, speak, cancelAudio } = setup()
  speak.mockResolvedValueOnce('unavailable').mockResolvedValueOnce('failed')
  await user.click(await screen.findByRole('button', { name: m.start }))
  expect(await screen.findByText(m.unavailable)).toBeTruthy()
  expect(screen.getByText(m.steps.language[1])).toBeTruthy()
  await user.click(screen.getByRole('button', { name: m.next }))
  expect(await screen.findByText(m.tryAudio)).toBeTruthy()
  speak.mockImplementation(() => new Promise(() => {}))
  await user.click(screen.getByRole('button', { name: m.replay }))
  const active = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  const beforeHidden = cancelAudio.mock.calls.length
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(cancelAudio.mock.calls.length).toBeGreaterThan(beforeHidden)
  active.mockReturnValue(false)
  expect(speak).toHaveBeenCalledTimes(3)
  await user.click(screen.getByRole('button', { name: m.replay }))
  const beforeUnmount = cancelAudio.mock.calls.length
  app.unmount()
  expect(cancelAudio.mock.calls.length).toBeGreaterThan(beforeUnmount)
})

it('recovers from browser errors after locale changes and applies the persisted locale after refresh', async () => {
  const { app, user, confirm, select } = setup(reportLedger())
  await user.click(await screen.findByRole('button', { name: en.tap }))
  const english = BrowserRecognition.current
  const stale = english.onresult
  await user.click(screen.getByRole('button', { name: 'Language: English' }))
  await user.click(screen.getByRole('option', { name: hi.label }))
  expect(english.abort).toHaveBeenCalledOnce()
  act(() => stale?.({ results: [[{ transcript: 'I received Rs 300' }]] }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: hi.messages.tap }))
  expect(BrowserRecognition.current.lang).toBe('hi-IN')
  act(() => BrowserRecognition.current.onerror?.({ error: 'service-not-allowed' }))
  expect(screen.getByText(hi.messages.speechUnavailable)).toBeTruthy()
  expect(screen.queryByText(hi.messages.denied)).toBeNull()
  await user.click(screen.getByRole('button', { name: hi.messages.retry }))
  act(() => BrowserRecognition.current.onerror?.({ error: 'no-speech' }))
  expect(screen.getByText(hi.messages.emptySpeech)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: `${hi.messages.language}: ${hi.label}` }))
  await user.click(screen.getByRole('option', { name: ml.label }))
  app.unmount()
  render(<App />)
  const input = await screen.findByRole<HTMLButtonElement>('button', { name: ml.messages.tap })
  await waitFor(() => expect(input.disabled).toBe(false))
  await user.click(input)
  expect(BrowserRecognition.current.lang).toBe('ml-IN')
  act(() => BrowserRecognition.current.onerror?.({ error: 'language-not-supported' }))
  expect(screen.getByText(ml.messages.speechLanguage)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(confirm).not.toHaveBeenCalled()
  expect(select).not.toHaveBeenCalled()
})

it('uses a final Hindi result queued after browser end to prefill editable payment review', async () => {
  localStorage.setItem('bolhaq-language', 'hi-IN')
  const { user, confirm } = setup(reportLedger())
  const mic = await screen.findByRole<HTMLButtonElement>('button', { name: hi.messages.tap })
  await waitFor(() => expect(mic.disabled).toBe(false))
  await user.click(mic)
  const browser = BrowserRecognition.current
  act(() => browser.onend?.())
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => browser.onresult?.({ results: [[{ transcript: 'मुझे 500 रुपये मिले' }]] }))
  const review = screen.getByRole('dialog', { name: hi.messages.payment })
  expect(within(review).getByRole<HTMLInputElement>('textbox', { name: hi.messages.amount }).value).toBe('500')
  expect(confirm).not.toHaveBeenCalled()
})

it('blocks repeat Malayalam starts after service denial and keeps typed payment review available', async () => {
  localStorage.setItem('bolhaq-language', 'ml-IN')
  const { user, confirm } = setup(reportLedger())
  const mic = await screen.findByRole<HTMLButtonElement>('button', { name: ml.messages.tap })
  await waitFor(() => expect(mic.disabled).toBe(false))
  await user.click(mic)
  const denied = BrowserRecognition.current
  act(() => denied.onerror?.({ error: 'service-not-allowed' }))
  expect(screen.getByText(ml.messages.speechServiceBlocked)).toBeTruthy()
  expect(screen.queryByRole('button', { name: ml.messages.retry })).toBeNull()
  await user.click(mic)
  expect(mic.disabled).toBe(true)
  expect(BrowserRecognition.current).toBe(denied)
  await user.click(screen.getByRole('button', { name: ml.messages.type }))
  await user.type(screen.getByRole('textbox', { name: ml.messages.type }), 'എനിക്ക് 1000 രൂപ കിട്ടി')
  await user.click(screen.getByRole('button', { name: ml.messages.send }))
  const review = screen.getByRole('dialog', { name: ml.messages.payment })
  expect(within(review).getByRole<HTMLInputElement>('textbox', { name: ml.messages.amount }).value).toBe('1000')
  expect(confirm).not.toHaveBeenCalled()
})
