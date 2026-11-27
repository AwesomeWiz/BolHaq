import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function ToolDialog({ title, closeLabel, busy, onClose, children }: {
  title: string; closeLabel: string; busy?: boolean; onClose(): void; children: ReactNode
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    if (!element) return
    element.showModal()
    return () => {
      element.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])
  useEffect(() => { heading.current?.focus() }, [title])

  return <dialog className="entry-dialog tool-dialog" ref={dialog} aria-labelledby={id} aria-busy={busy || undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="tool-heading">
      <h2 ref={heading} id={id} tabIndex={-1}>{title}</h2>
      <button className="button close-button" type="button" aria-label={closeLabel} onClick={onClose} disabled={busy}>
        <X size={22} aria-hidden="true" />
      </button>
    </div>
    <div className="tool-content">{children}</div>
  </dialog>
}
