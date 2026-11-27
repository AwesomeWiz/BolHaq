import { useState } from 'react'
import { dateLabel } from '../locales'
import type { Locale } from '../locales'
import { localDate } from '../domain/ledger'
import type { Employer } from '../domain/ledger'
import { matchingWorksites } from '../domain/reports'
import type { Messages } from '../locales/en'

export function WorksiteSelect({ employers, value, locale, t, onChange }: {
  employers: readonly Employer[]; value?: string; locale: Locale; t: Messages; onChange(value: string): void
}) {
  const number = new Intl.NumberFormat(locale)
  return <label>{t.worksite}
    <select name="worksite" className="command-site-select" value={value ?? ''} required onChange={event => onChange(event.target.value)}>
      <option value="">{t.chooseEmployer}</option>
      {employers.map(site => {
        const matching = matchingWorksites(employers, site.name)
        const label = matching.length > 1
          ? [site.name, dateLabel(localDate(new Date(site.createdAt)), locale), site.description,
            number.format(matching.indexOf(site) + 1)].filter(Boolean).join(' · ')
          : ''
        return <option key={site.id} value={site.id}>{label || site.name}</option>
      })}
    </select>
  </label>
}

export function WorksiteChoice({ employers, siteId, message, scope, locale, t, onChoose, onCancel }: {
  employers: readonly Employer[]; siteId?: string; message?: string; scope: 'select' | 'balance'; locale: Locale; t: Messages
  onChoose(id: string): void; onCancel(): void
}) {
  const [choice, setChoice] = useState(siteId)
  return <form className="entry-form" onSubmit={event => {
    event.preventDefault()
    if (choice) onChoose(choice)
  }}>
    {message && <p className="notice" role="status">{message}</p>}
    <WorksiteSelect employers={employers} value={choice} t={t} locale={locale} onChange={setChoice} />
    <div className="dialog-actions">
      <button className="button" type="button" onClick={onCancel}>{t.cancel}</button>
      <button className="button primary" type="submit" disabled={!choice}>{scope === 'select' ? t.switchWorksite : t.speakBalance}</button>
    </div>
  </form>
}
