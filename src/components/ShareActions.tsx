import { useState } from 'react'
import { Copy, ExternalLink, Share2 } from 'lucide-react'
import type { ToolMessages } from '../locales/wageTools'

export function ShareActions({ title, text, w, whatsapp = false }: {
  title: string; text: string; w: ToolMessages; whatsapp?: boolean
}) {
  const [feedback, setFeedback] = useState<{ key: keyof ToolMessages; text: string }>()
  const [sharing, setSharing] = useState(false)
  const message = feedback?.text === text ? feedback.key : undefined
  function update(key: keyof ToolMessages) { setFeedback({ key, text }) }

  async function copy(fallback = false) {
    try {
      await navigator.clipboard.writeText(text)
      update(fallback ? 'shareFallback' : 'copied')
    } catch {
      update('copyManual')
    }
  }

  async function share() {
    const data = { title, text }
    try {
      if (typeof navigator.share !== 'function' || navigator.canShare?.(data) === false) {
        await copy(true)
        return
      }
      setSharing(true)
      update('sharing')
      await navigator.share(data)
      update('shareReady')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setFeedback(undefined)
      else await copy(true)
    } finally { setSharing(false) }
  }

  const disabled = !text.trim() || sharing
  return <>
    <div className="tool-buttons">
      <button className="button primary" type="button" disabled={disabled} onClick={() => void share()}>
        <Share2 size={17} aria-hidden="true" />{w.share}
      </button>
      <button className="button" type="button" disabled={disabled} onClick={() => void copy()}>
        <Copy size={17} aria-hidden="true" />{w.copy}
      </button>
      {whatsapp && !disabled && <a className="button" href={`https://wa.me/?${new URLSearchParams({ text })}`}
        target="_blank" rel="noreferrer"><ExternalLink size={17} aria-hidden="true" />{w.whatsapp}</a>}
    </div>
    <p className="tool-status" role="status">{message && w[message]}</p>
    {message === 'copyManual' && <textarea aria-label={w.copyManual} value={text} rows={5} readOnly
      onFocus={event => event.currentTarget.select()} />}
  </>
}
