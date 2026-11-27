// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { applyConfirmed } from '../domain/ledger'
import { dateLabel, languages } from '../locales'
import type { Locale } from '../locales'
import { en } from '../locales/en'
import { ledgerStore } from '../services/storage'
import { reportLedger } from './fixtures/reportLedger'
import { attendance, contractorPayment, noPayment } from './fixtures/naturalCommandHotfix'

const today = '2026-11-27'
const yesterday = '2026-11-26'
const messages = (locale: Locale) => languages.find(language => language.code === locale)!.messages

function setup(locale: Locale = 'en-IN', duplicate = false) {
  let data = reportLedger()
  if (duplicate) data = { ...data, employers: [
    ...data.employers, { ...data.employers[1], id: 'b2', description: 'Night shift' },
  ] }
  localStorage.setItem('bolhaq-language', locale)
  vi.spyOn(ledgerStore, 'read').mockImplementation(async () => data)
  const confirm = vi.spyOn(ledgerStore, 'confirm').mockImplementation(async (proposal, id) => {
    data = applyConfirmed(data, proposal, id)
    return data
  })
  const select = vi.spyOn(ledgerStore, 'select').mockImplementation(async id => {
    data = { ...data, activeId: id }
    return data
  })
  const user = userEvent.setup()
  const t = messages(locale)
  render(<App />)
  return { user, t, confirm, select, read: () => data }
}

function fakeRecognition() {
  class Recognition {
    static current?: Recognition
    onstart?: () => void
    onresult?: (event: { results: { transcript: string }[][] }) => void
    start() { Recognition.current = this; this.onstart?.() }
  }
  vi.stubGlobal('SpeechRecognition', Recognition)
  return (transcript: string) => act(() => Recognition.current?.onresult?.({ results: [[{ transcript }]] }))
}

async function typeCommand(user: ReturnType<typeof userEvent.setup>, command: string, t = en) {
  if (!screen.queryByRole('textbox', { name: t.type })) await user.click(await screen.findByRole('button', { name: t.type }))
  const input = screen.getByRole('textbox', { name: t.type })
  await user.clear(input)
  await user.type(input, command)
  await user.click(screen.getByRole('button', { name: t.send }))
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
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

for (const source of ['typed', 'speech'] as const) {
  it.each([
    ['ml-IN', attendance, 'work', 'days', '1', today],
    ['hi-IN', contractorPayment, 'payment', 'amount', '500', yesterday],
  ] as const)('prepares %s attendance or payment through ' + source + ' for %s', async (locale, text, kind, field, value, date) => {
    const emit = fakeRecognition()
    const { user, t, confirm, select } = setup(locale)
    if (source === 'typed') await typeCommand(user, text, t)
    else {
      await user.click(await screen.findByRole('button', { name: t.tap }))
      emit(text)
    }
    const dialog = within(screen.getByRole('dialog', { name: t[kind] }))
    expect(dialog.getByRole<HTMLInputElement>('textbox', { name: t[field] }).value).toBe(value)
    expect(dialog.getByText(dateLabel(date, locale))).toBeTruthy()
    expect(dialog.getByText('कलूर Site')).toBeTruthy()
    expect(dialog.getByRole('button', { name: t.confirm })).toBeTruthy()
    expect(confirm).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('button', { name: t.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(confirm).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
  })
  it.each(noPayment)('acknowledges %s non-payment through ' + source + ' for %s', async (locale, text) => {
    const emit = fakeRecognition()
    const { user, t, confirm, select, read } = setup(locale)
    const before = read()
    if (source === 'typed') await typeCommand(user, text, t)
    else {
      await user.click(await screen.findByRole('button', { name: t.tap }))
      emit(text)
    }
    expect(screen.getByText(t.paymentNotReceived)).toBeTruthy()
    expect(screen.queryByText(t.clarifyPaymentState)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    expect(read()).toEqual(before)
  })
}

it('previews a typed payment for a different worksite and date, and changes records only on confirmation', async () => {
  const { user, confirm, select, read } = setup()
  await typeCommand(user, 'ABC Construction paid me 1500 yesterday.')
  let dialog = within(await screen.findByRole('dialog', { name: en.payment }))
  expect(dialog.getByRole<HTMLInputElement>('textbox', { name: en.amount }).value).toBe('1500')
  expect(dialog.getByText('ABC Construction')).toBeTruthy()
  expect(dialog.getByText(dateLabel(yesterday, 'en-IN'))).toBeTruthy()
  await user.click(dialog.getByRole('button', { name: en.cancel }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(confirm).not.toHaveBeenCalled()
  await typeCommand(user, 'ABC Construction paid me 1500 yesterday.')
  dialog = within(await screen.findByRole('dialog', { name: en.payment }))
  await user.click(dialog.getByRole('button', { name: en.confirm }))
  expect(confirm.mock.calls[0][0]).toMatchObject({ kind: 'payment', amount: 150_000, date: yesterday, employerId: 'a' })
  expect(select).not.toHaveBeenCalled()
  expect(read().activeId).toBe('b')
})

it.each([
  ['hi-IN', 'मुझे कल दो हजार रुपये मिले।'],
  ['ml-IN', 'ഇന്നലെ എനിക്ക് രണ്ടായിരം രൂപ കിട്ടി.'],
] as const)('prefills a dated speech result in %s', async (locale, transcript) => {
  const emit = fakeRecognition()
  const { user, t, confirm } = setup(locale)
  await user.click(await screen.findByRole('button', { name: t.tap }))
  emit(transcript)
  const dialog = within(screen.getByRole('dialog', { name: t.payment }))
  expect(dialog.getByRole<HTMLInputElement>('textbox', { name: t.amount }).value).toBe('2000')
  expect(dialog.getByText(dateLabel(yesterday, locale))).toBeTruthy()
  expect(dialog.getByText(transcript)).toBeTruthy()
  expect(confirm).not.toHaveBeenCalled()
})

it('lets the worker edit a recognized ambiguous command and retry without making a write', async () => {
  const emit = fakeRecognition()
  const { user, confirm } = setup()
  await user.click(await screen.findByRole('button', { name: en.tap }))
  emit('They paid me 600 or 700.')
  const dialog = within(screen.getByRole('dialog', { name: en.payment }))
  expect(dialog.getByRole<HTMLInputElement>('textbox', { name: en.amount }).value).toBe('')
  expect(dialog.queryByRole('button', { name: en.confirm })).toBeNull()
  await user.click(dialog.getByRole('button', { name: en.editCommand }))
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: en.type }).value).toBe('They paid me 600 or 700.')
  await typeCommand(user, 'They paid me 700.')
  const reviewed = within(screen.getByRole('dialog', { name: en.payment }))
  expect(reviewed.getByRole<HTMLInputElement>('textbox', { name: en.amount }).value).toBe('700')
  expect(reviewed.getByText(dateLabel(today, 'en-IN'))).toBeTruthy()
  expect(confirm).not.toHaveBeenCalled()
})

it('stops ambiguous named payments at the worksite chooser and requires review before confirmation', async () => {
  const { user, confirm } = setup('en-IN', true)
  await typeCommand(user, 'कलूर Site paid me 500.')
  const dialog = within(screen.getByRole('dialog', { name: en.payment }))
  expect(dialog.getByText(en.clarifyDuplicateWorksite)).toBeTruthy()
  expect(dialog.queryByRole('button', { name: en.confirm })).toBeNull()
  const choice = dialog.getByRole<HTMLSelectElement>('combobox', { name: en.worksite })
  expect(choice.value).toBe('')
  await user.selectOptions(choice, 'b')
  await user.click(dialog.getByRole('button', { name: en.review }))
  expect(dialog.getByText('कलूर Site')).toBeTruthy()
  expect(dialog.getByRole('button', { name: en.confirm })).toBeTruthy()
  expect(confirm).not.toHaveBeenCalled()
})

it('switches via voice only after the worker accepts the resolved worksite', async () => {
  const emit = fakeRecognition()
  const { user, confirm, select } = setup()
  await user.click(await screen.findByRole('button', { name: en.tap }))
  emit('Switch to ABC Construction.')
  const dialog = within(screen.getByRole('dialog', { name: en.switchWorksite }))
  expect(dialog.getByRole<HTMLSelectElement>('combobox', { name: en.worksite }).value).toBe('a')
  expect(select).not.toHaveBeenCalled()
  await user.click(dialog.getByRole('button', { name: en.switchWorksite }))
  expect(select).toHaveBeenCalledExactlyOnceWith('a')
  expect(confirm).not.toHaveBeenCalled()
})

it.each([
  ['en-IN', 'I did not receive 2000 rupees.'],
  ['hi-IN', 'मुझे दो हजार रुपये नहीं मिले।'],
  ['ml-IN', 'എനിക്ക് രണ്ടായിരം രൂപ കിട്ടിയില്ല.'],
] as const)('does not create a received-payment draft from negated speech in %s', async (locale, transcript) => {
  const emit = fakeRecognition()
  const { user, t, confirm } = setup(locale)
  await user.click(await screen.findByRole('button', { name: t.tap }))
  emit(transcript)
  expect(screen.getByText(t.paymentNotReceived)).toBeTruthy()
  expect(screen.queryByText(t.clarifyPaymentState)).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(confirm).not.toHaveBeenCalled()
})

it('asks for a single action when a typed command combines work and payment', async () => {
  const { user, confirm } = setup()
  await typeCommand(user, 'I worked today and received 500.')
  expect(screen.getByText(en.clarifyOneAction)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(confirm).not.toHaveBeenCalled()
})
