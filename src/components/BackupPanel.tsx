import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { BackupError, backupSizeLimit, exportBackup, readBackup } from '../domain/backup'
import { localDate } from '../domain/ledger'
import type { Ledger } from '../domain/ledger'
import { dateLabel } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'
import type { ToolMessages } from '../locales/wageTools'

export function BackupPanel({ locale, t, w, saving, onRead, onRestore }: {
  locale: Locale; t: Messages; w: ToolMessages; saving: boolean
  onRead(): Promise<Ledger>; onRestore(content: string): Promise<void>
}) {
  const [preview, setPreview] = useState<{ content: string; backup: ReturnType<typeof readBackup> }>()
  const [status, setStatus] = useState<keyof ToolMessages>()
  const [error, setError] = useState<keyof ToolMessages>()
  const [exporting, setExporting] = useState(false)
  const selection = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const statusRegion = useRef<HTMLParagraphElement>(null)
  const number = new Intl.NumberFormat(locale)
  useEffect(() => {
    if (status === 'restoreDone') statusRegion.current?.focus()
  }, [status])

  async function download() {
    setError(undefined)
    setStatus(undefined)
    setExporting(true)
    try {
      const { content, filename } = exportBackup(await onRead())
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      try { link.click() } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setStatus('backupStarted')
    } catch {
      setError('backupExportFailed')
    } finally {
      setExporting(false)
    }
  }

  async function select(file?: File) {
    const attempt = ++selection.current
    setPreview(undefined)
    setError(undefined)
    setStatus(file ? 'backupReading' : undefined)
    if (!file) return
    try {
      if (file.size > backupSizeLimit) throw new BackupError('backupLarge')
      const content = await file.text()
      const backup = readBackup(content)
      if (attempt === selection.current) setPreview({ content, backup })
    } catch (cause) {
      if (attempt === selection.current) setError(cause instanceof BackupError ? cause.issue : 'badBackup')
      if (attempt === selection.current && fileInput.current) fileInput.current.value = ''
    } finally {
      if (attempt === selection.current) setStatus(undefined)
    }
  }

  function clear() {
    void select()
    if (fileInput.current) { fileInput.current.value = ''; fileInput.current.focus() }
  }

  async function restore() {
    if (!preview || saving) return
    setError(undefined)
    setStatus(undefined)
    try {
      await onRestore(preview.content)
      clear()
      setStatus('restoreDone')
    } catch {
      setError('restoreFailed')
    }
  }

  return <>
    <p>{w.backupIntro}</p>
    <div className="tool-buttons">
      <button className="button" type="button" onClick={() => void download()} disabled={saving || exporting}>
        <Download size={18} aria-hidden="true" />{w.backupDownload}
      </button>
    </div>
    <label>{w.chooseFile}<input ref={fileInput} type="file" accept=".json,application/json" disabled={saving}
      onChange={event => void select(event.target.files?.[0])} /></label>
    {error && <p className="notice error" role="alert">{w[error]}</p>}
    <p ref={statusRegion} className="tool-status" role="status" tabIndex={-1}>{status && w[status]}</p>
    {preview && <>
      <dl className="tool-metrics">
        <div><dt>{w.backupDate}</dt><dd>{dateLabel(localDate(new Date(preview.backup.exportedAt)), locale)}</dd></div>
        <div><dt>{w.worksiteCount}</dt><dd>{number.format(preview.backup.ledger.employers.length)}</dd></div>
        <div><dt>{w.workCount}</dt><dd>{number.format(preview.backup.ledger.work.length)}</dd></div>
        <div><dt>{w.paymentCount}</dt><dd>{number.format(preview.backup.ledger.payments.length)}</dd></div>
      </dl>
      <p className="notice error">{w.restoreWarning}</p>
      <div className="tool-buttons">
        <button className="button" type="button" onClick={clear} disabled={saving}>{w.restoreCancel}</button>
        <button className="button restore-action" type="button" onClick={() => void restore()} disabled={saving || exporting}>
          <Upload size={18} aria-hidden="true" />{saving ? t.saving : w.restoreReplace}
        </button>
      </div>
    </>}
  </>
}
