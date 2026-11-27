// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { exportBackup } from '../domain/backup'
import { emptyLedger } from '../domain/ledger'
import { en } from '../locales/en'
import { wageTools } from '../locales/wageTools'
import { speechToText } from '../services/speech'
import { ledgerStore } from '../services/storage'
import { reportLedger } from './fixtures/reportLedger'

const enTools = wageTools('en-IN')

function unsettledLedger() {
  const ledger = reportLedger()
  ledger.payments = ledger.payments.filter(entry => entry.id !== 'a-settled')
  return ledger
}

function start(ledger = unsettledLedger()) {
  vi.spyOn(ledgerStore, 'read').mockResolvedValue(ledger)
  const confirm = vi.spyOn(ledgerStore, 'confirm')
  const user = userEvent.setup()
  const app = render(<App />)
  return { user, confirm, app }
}

function useRecognition() {
  class BrowserRecognition {
    static current: BrowserRecognition | undefined
    onstart?: () => void
    onresult?: (event: { results: { transcript: string }[][] }) => void
    abort = vi.fn()
    start() { BrowserRecognition.current = this; this.onstart?.() }
  }
  vi.stubGlobal('SpeechRecognition', BrowserRecognition)
  return BrowserRecognition
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 27, 12))
  localStorage.clear()
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  }
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'share')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('opens a named wage statement through the real recognition handler without writing or switching worksites', async () => {
  const browser = useRecognition()
  const { user, confirm } = start()
  const select = vi.spyOn(ledgerStore, 'select')
  await user.click(await screen.findByRole('button', { name: en.tap }))
  act(() => browser.current?.onresult?.({ results: [[{ transcript: 'Make a report for ABC Construction.' }]] }))
  const dialog = screen.getByRole('dialog', { name: enTools.statement })
  const report = within(dialog)
  expect(report.getByRole('heading', { name: 'ABC Construction' })).toBeTruthy()
  expect(report.getByText(enTools.disclaimer)).toBeTruthy()
  expect(report.getByText('Outstanding wages · ₹2,500')).toBeTruthy()
  expect(report.getByText('1 × ₹700', { exact: false })).toBeTruthy()
  expect(report.getByText('3 × ₹800', { exact: false })).toBeTruthy()
  expect(report.getByRole('button', { name: enTools.print })).toBeTruthy()
  expect(confirm).not.toHaveBeenCalled()
  expect(select).not.toHaveBeenCalled()
})

it('offers an editable Hindi reminder while the interface stays in English and shares only on click', async () => {
  const { user, confirm } = start()
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  await user.click(await screen.findByRole('button', { name: enTools.reminder }))
  const report = within(screen.getByRole('dialog'))
  await user.selectOptions(report.getByLabelText(en.worksite), 'a')
  const preview = report.getByRole<HTMLTextAreaElement>('textbox', { name: enTools.messagePreview })
  expect(preview.value).toContain('₹2,500')
  await user.click(report.getByRole('button', { name: /Message language/ }))
  await user.click(report.getByRole('option', { name: 'हिंदी' }))
  expect(preview.value).toContain('अभी की बकाया मज़दूरी')
  expect(document.documentElement.lang).toBe('en-IN')
  expect(share).not.toHaveBeenCalled()
  await user.clear(preview)
  await user.type(preview, 'My edited message for ABC Construction.')
  const whatsapp = report.getByRole<HTMLAnchorElement>('link', { name: enTools.whatsapp })
  expect(new URL(whatsapp.href).searchParams.get('text')).toBe('My edited message for ABC Construction.')
  expect(share).not.toHaveBeenCalled()
  await user.click(report.getByRole('button', { name: enTools.share }))
  expect(share).toHaveBeenCalledWith({ title: wageTools('hi-IN').reminder, text: 'My edited message for ABC Construction.' })
  expect(confirm).not.toHaveBeenCalled()
})

it('shows an advance instead of generating a payment demand', async () => {
  const { user } = start()
  await user.click(await screen.findByRole('button', { name: enTools.reminder }))
  const report = within(screen.getByRole('dialog'))
  expect(report.getByText(enTools.noDemand)).toBeTruthy()
  expect(report.getByText(`${en.advance} · ₹500`)).toBeTruthy()
  expect(report.queryByRole('link', { name: enTools.whatsapp })).toBeNull()
  expect(report.queryByRole('button', { name: enTools.share })).toBeNull()
})

it('opens a worksite from the aggregate report without changing the active ledger site', async () => {
  const { user } = start()
  const select = vi.spyOn(ledgerStore, 'select')
  const trigger = await screen.findByRole('button', { name: enTools.overview })
  await user.click(trigger)
  const report = within(screen.getByRole('dialog'))
  await user.selectOptions(report.getByLabelText(enTools.period), 'month')
  expect(report.getAllByText('₹2,500', { exact: true })).toHaveLength(2)
  expect(report.getAllByText('₹500', { exact: true })).toHaveLength(2)
  expect(report.getByText('₹4,100', { exact: true })).toBeTruthy()
  await user.click(report.getByRole('button', { name: 'View statement for ABC Construction' }))
  expect(screen.getByRole('dialog', { name: enTools.statement })).toBeTruthy()
  expect(select).not.toHaveBeenCalled()
  await user.click(report.getByRole('button', { name: en.closeDialog }))
  expect(document.activeElement).toBe(trigger)
})

it('previews a backup, cancels without replacing, then applies the explicitly confirmed replacement', async () => {
  const { user } = start()
  const restored = { ...unsettledLedger(), activeId: 'a' }
  const restore = vi.spyOn(ledgerStore, 'restore').mockResolvedValue(restored)
  await user.click(await screen.findByRole('button', { name: enTools.backup }))
  const dialog = within(screen.getByRole('dialog'))
  const payload = exportBackup(restored)
  const file = Object.assign(new File([payload.content], payload.filename, { type: 'application/json' }), {
    text: async () => payload.content,
  })
  const input = dialog.getByLabelText(enTools.chooseFile)
  fireEvent.change(input, { target: { files: [file] } })
  expect(await dialog.findByText(enTools.restoreWarning)).toBeTruthy()
  expect(dialog.getByText(enTools.backupDate)).toBeTruthy()
  expect(dialog.getByText(enTools.workCount)).toBeTruthy()
  expect(dialog.getByText(enTools.paymentCount)).toBeTruthy()
  await user.click(dialog.getByRole('button', { name: enTools.restoreCancel }))
  expect(dialog.queryByText(enTools.restoreWarning)).toBeNull()
  expect(restore).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { files: [file] } })
  await user.click(await dialog.findByRole('button', { name: enTools.restoreReplace }))
  expect(restore).toHaveBeenCalledExactlyOnceWith(payload.content)
  expect(await dialog.findByText(enTools.restoreDone)).toBeTruthy()
  await user.click(dialog.getByRole('button', { name: en.closeDialog }))
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: en.worksite }).value).toBe('a')
})

it('shows the first-run guide in the selected language and remembers skipping it without asking for mic access', async () => {
  const { user, confirm, app } = start(emptyLedger())
  const listen = vi.spyOn(speechToText, 'listen')
  expect(await screen.findByRole('heading', { name: enTools.guide })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Language: English' }))
  await user.click(screen.getByRole('option', { name: 'മലയാളം' }))
  const ml = wageTools('ml-IN')
  expect(screen.getByRole('heading', { name: ml.guide })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: ml.guideSkip }))
  expect(screen.queryByRole('heading', { name: ml.guide })).toBeNull()
  expect(listen).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()
  app.unmount()
  render(<App />)
  await screen.findByRole('button', { name: ml.backup })
  expect(screen.queryByRole('heading', { name: ml.guide })).toBeNull()
})

it('preserves an existing ledger and never opens the first-run guide over it', async () => {
  const { confirm } = start()
  expect(await screen.findByRole('combobox', { name: en.worksite })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: enTools.guide })).toBeNull()
  expect(confirm).not.toHaveBeenCalled()
})

it('cancels an active session when the tab becomes hidden and ignores a late result', async () => {
  const browser = useRecognition()
  const { user, confirm } = start()
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  await user.click(await screen.findByRole('button', { name: en.tap }))
  const session = browser.current
  hidden.mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(session?.abort).toHaveBeenCalledOnce()
  expect(screen.getByText(en.speechInterrupted)).toBeTruthy()
  act(() => session?.onresult?.({ results: [[{ transcript: 'I received 2000 rupees.' }]] }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(confirm).not.toHaveBeenCalled()
  hidden.mockReturnValue(false)
  fireEvent(document, new Event('visibilitychange'))
  await user.click(screen.getByRole('button', { name: en.tap }))
  expect(browser.current).not.toBe(session)
  expect(screen.getByText(en.listening)).toBeTruthy()
})
