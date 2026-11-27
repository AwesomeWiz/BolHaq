import { currentAgreement, LedgerError, localDate, normalizeDigits, readPaise, validateProposal, workOn } from '../domain/ledger'
import type { Ledger, Proposal, WorkEntry } from '../domain/ledger'
import type { Draft, Editor } from '../components/EntryDialog'
import type { ParsedIntent } from '../domain/intent'

function asRupees(paise?: number | null) {
  return paise == null ? '' : (paise / 100).toFixed(paise % 100 ? 2 : 0)
}

export function newDraft(kind: Draft['kind'], ledger: Ledger): Draft {
  const employerId = kind === 'employer' ? undefined : ledger.activeId ?? undefined
  return {
    kind, employerId, name: '', description: '', date: localDate(), days: '1', amount: '',
    rate: kind === 'wage' && employerId ? asRupees(currentAgreement(ledger, employerId)?.rate) : '',
  }
}

export function draftFromIntent(parsed: ParsedIntent, ledger: Ledger): Draft | null {
  switch (parsed.intent) {
    case 'CREATE_EMPLOYER': return { ...newDraft('employer', ledger), name: parsed.parameters.name, rate: asRupees(parsed.parameters.rate) }
    case 'SET_DAILY_WAGE': return { ...newDraft('wage', ledger), rate: asRupees(parsed.parameters.rate) }
    case 'RECORD_WORK': return { ...newDraft('work', ledger), date: parsed.parameters.date ?? '', days: String(parsed.parameters.days ?? '') }
    case 'RECORD_PAYMENT': return { ...newDraft('payment', ledger), amount: asRupees(parsed.parameters.amount) }
    default: return null
  }
}

function makeProposal(draft: Draft, ledger: Ledger, replaces?: WorkEntry): Proposal {
  const id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('')
  const rate = readPaise(draft.rate) ?? 0
  if (draft.kind === 'employer') return { id, kind: 'employer', name: draft.name.trim(), description: draft.description.trim(), rate }
  const employerId = draft.employerId
  const agreement = employerId && currentAgreement(ledger, employerId)
  if (!employerId || !agreement) throw new LedgerError('chooseEmployer')
  if (draft.kind === 'wage') return { id, kind: 'wage', employerId, rate, agreementId: agreement.id }
  if (draft.kind === 'payment') return { id, kind: 'payment', employerId, date: draft.date, amount: readPaise(draft.amount) ?? 0 }
  const numericDays = normalizeDigits(draft.days.trim())
  return { id, kind: 'work', employerId, date: draft.date, days: /^\d+$/.test(numericDays) ? Number(numericDays) : 0,
    rate: replaces?.rate ?? agreement.rate, agreementId: agreement.id, replaces: replaces?.id }
}

export function reviewDraft(draft: Draft, ledger: Ledger, replacement?: WorkEntry): Editor {
  try {
    const proposal = makeProposal(draft, ledger, replacement)
    validateProposal(ledger, proposal)
    return { stage: 'review', draft, proposal, existing: replacement }
  } catch (error) {
    if (!(error instanceof LedgerError)) throw error
    if (error.issue === 'duplicateWork' && draft.employerId) {
      return { stage: 'conflict', draft, existing: workOn(ledger, draft.employerId, draft.date) }
    }
    return { stage: 'edit', draft, error: error.issue }
  }
}
