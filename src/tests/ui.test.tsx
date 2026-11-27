// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { LanguagePicker } from '../components/LanguagePicker'
import { TransactionList, WageBalance } from '../components/LedgerPanels'
import { applyConfirmed, emptyLedger, localDate } from '../domain/ledger'
import type { Ledger, Proposal } from '../domain/ledger'
import { en } from '../locales/en'
import { speechToText } from '../services/speech'
import { ledgerStore } from '../services/storage'

const site: Proposal = { kind: 'employer', id: 'site', name: 'ABC Construction', description: '', rate: 70_000 }
const work: Proposal = { kind: 'work', id: 'work', employerId: site.id, agreementId: site.id, days: 6, rate: 70_000, date: localDate() }
const payment: Proposal = { kind: 'payment', id: 'payment', employerId: site.id, amount: 200_000, date: localDate() }
const initial = () => applyConfirmed(emptyLedger(), site, site.id)

describe('confirmation and recording UI', () => {
  let ledger: Ledger
  let callbacks: Parameters<typeof speechToText.listen>[1]
  let stop: ReturnType<typeof vi.fn<() => void>>
  let cancel: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    localStorage.clear()
    ledger = initial()
    vi.spyOn(ledgerStore, 'read').mockImplementation(async () => ledger)
    vi.spyOn(ledgerStore, 'confirm').mockImplementation(async (proposal, id) => {
      ledger = applyConfirmed(ledger, proposal, id)
      return ledger
    })
    vi.spyOn(speechToText, 'available').mockReturnValue(true)
    stop = vi.fn(() => callbacks.processing())
    cancel = vi.fn()
    vi.spyOn(speechToText, 'listen').mockImplementation((_locale, handlers) => {
      callbacks = handlers
      return { stop, cancel }
    })
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
      HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    }
  })

  async function start() {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: en.speakBalance })
    return user
  }

  async function speak(user: ReturnType<typeof userEvent.setup>, transcript: string) {
    await user.click(screen.getByRole('button', { name: en.tap }))
    act(() => { callbacks.started(); callbacks.recognized(transcript) })
    return screen.getByRole('dialog')
  }

  it('prefills the recognized payment and saves immediately on explicit confirmation', async () => {
    const user = await start()
    const dialog = await speak(user, 'I received 2000 rupees.')
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.amount }).value).toBe('2000')
    expect(within(dialog).getByText('₹2,000')).toBeTruthy()
    expect(within(dialog).getByText(site.name)).toBeTruthy()
    expect(ledgerStore.confirm).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: en.confirm }))
    expect(ledger.payments.map(entry => entry.amount)).toEqual([200_000])
    expect(await screen.findByText(en.success)).toBeTruthy()
  })

  it('prefills the daily wage and commits the edited pending amount', async () => {
    const user = await start()
    const dialog = await speak(user, 'My daily wage is 850 rupees.')
    const rate = within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.wageInput })
    expect(rate.value).toBe('850')
    await user.clear(rate)
    await user.type(rate, '900.50')
    expect(within(dialog).getByText('₹900.50')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: en.confirm }))
    expect(ledger.agreements.map(agreement => agreement.rate)).toEqual([70_000, 90_050])
  })

  it('prefills workday counts and worksite names from structured commands', async () => {
    const user = await start()
    let dialog = await speak(user, 'I worked six days.')
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.days }).value).toBe('6')
    expect(within(dialog).getByText('₹4,200')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: en.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialog = await speak(user, 'Add worksite Metro Site at 700 rupees per day.')
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.name }).value).toBe('Metro Site')
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.wageInput }).value).toBe('700')
  })

  it('focuses the missing field and keeps known values', async () => {
    const user = await start()
    const dialog = await speak(user, 'Add worksite Metro Site.')
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.name }).value).toBe('Metro Site')
    const rate = within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.wageInput })
    expect(rate.value).toBe('')
    expect(document.activeElement).toBe(rate)
    expect(ledgerStore.confirm).not.toHaveBeenCalled()
  })

  it('rejects an invalid inline edit and cancels without persistence', async () => {
    const user = await start()
    const dialog = await speak(user, 'I received 2000 rupees.')
    const amount = within(dialog).getByRole<HTMLInputElement>('textbox', { name: en.amount })
    await user.clear(amount)
    await user.type(amount, '-42')
    await user.click(within(dialog).getByRole('button', { name: en.confirm }))
    expect(within(dialog).getByRole('alert').textContent).toBe(en.invalid)
    await user.click(within(dialog).getByRole('button', { name: en.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ledgerStore.confirm).not.toHaveBeenCalled()
    expect(ledger.payments).toEqual([])
  })

  it('blocks double confirmation and waits for storage before showing success', async () => {
    const user = await start()
    const dialog = await speak(user, 'I received 2000 rupees.')
    let complete!: (data: Ledger) => void
    vi.mocked(ledgerStore.confirm).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const confirm = within(dialog).getByRole<HTMLButtonElement>('button', { name: en.confirm })
    act(() => { confirm.click(); confirm.click() })
    expect(ledgerStore.confirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(en.success)).toBeNull()
    expect(confirm.disabled).toBe(true)
    await act(async () => complete(applyConfirmed(ledger, payment, payment.id)))
    expect(screen.getByText(en.success)).toBeTruthy()
  })

  it('shows startup, timed listening, sound activity, processing, and cancellation', async () => {
    const user = await start()
    const panel = screen.getByRole('region', { name: en.voice })
    await user.click(screen.getByRole('button', { name: en.tap }))
    expect(panel.dataset.state).toBe('starting')
    act(() => { callbacks.started(); callbacks.sound(true) })
    expect(panel.dataset.state).toBe('listening')
    expect(panel.dataset.sound).toBe('true')
    expect(within(panel).getByText('00:00')).toBeTruthy()
    act(() => callbacks.sound(false))
    expect(panel.dataset.sound).toBeUndefined()
    await user.click(within(panel).getByRole('button', { name: en.stop }))
    expect(stop).toHaveBeenCalledOnce()
    expect(panel.dataset.state).toBe('processing')
    await user.click(within(panel).getByRole('button', { name: en.cancel }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(panel.dataset.state).toBe('idle')
    await user.click(screen.getByRole('button', { name: en.tap }))
    act(() => callbacks.failed('denied'))
    expect(panel.dataset.state).toBe('error')
    expect(within(panel).getByText(en.denied)).toBeTruthy()
  })
})

it('opens the language list, selects by keyboard, restores focus and dismisses outside', async () => {
  const user = userEvent.setup()
  const select = vi.fn()
  const view = render(<><LanguagePicker locale="en-IN" label="Language" onSelect={select} /><button>Outside</button></>)
  const trigger = screen.getByRole('button', { name: /Language: English/ })
  await user.click(trigger)
  expect(screen.getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(screen.getByRole('listbox'))
  await user.keyboard('{ArrowDown}{Enter}')
  expect(select).toHaveBeenCalledWith('ml-IN')
  expect(document.activeElement).toBe(trigger)
  view.rerender(<><LanguagePicker locale="ml-IN" label="Language" onSelect={select} /><button>Outside</button></>)
  const current = screen.getByRole('button', { name: /മലയാളം/ })
  await user.click(current)
  expect(screen.getByRole('option', { name: 'മലയാളം' }).getAttribute('aria-selected')).toBe('true')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(document.activeElement).toBe(current)
  await user.click(current)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('groups dated activity and applies receipt styling only to payments', () => {
  const ledger = applyConfirmed(applyConfirmed(initial(), work, work.id), payment, payment.id)
  render(<TransactionList t={en} locale="en-IN" ledger={ledger} />)
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
  const rows = screen.getAllByRole('listitem')
  const received = rows.find(row => row.textContent?.includes(en.paymentEntry))!
  const worked = rows.find(row => row.textContent?.includes(en.workEntry))!
  expect(received.textContent).toContain(site.name)
  expect(worked.textContent).toContain(site.name)
  expect(within(received).getByText('+ ₹2,000').classList.contains('receipt-text')).toBe(true)
  expect(within(worked).getByText('₹4,200').classList.contains('receipt-text')).toBe(false)
})

it('distinguishes settled and advance balances in text', () => {
  const earned = applyConfirmed(initial(), work, work.id)
  const settled = applyConfirmed(earned, { ...payment, amount: 420_000 }, payment.id)
  const view = render(<WageBalance t={en} locale="en-IN" ledger={settled} employerId={site.id} onSpeak={() => {}} />)
  expect(screen.getByRole('heading', { name: en.settled })).toBeTruthy()
  const advanced = applyConfirmed(initial(), payment, payment.id)
  view.rerender(<WageBalance t={en} locale="en-IN" ledger={advanced} employerId={site.id} onSpeak={() => {}} />)
  expect(screen.getByRole('heading', { name: en.advance })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: en.outstanding })).toBeNull()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
