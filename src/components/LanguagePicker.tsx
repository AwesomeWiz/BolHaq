import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Globe2 } from 'lucide-react'
import { languages } from '../locales'
import type { Locale } from '../locales'
import type { Messages } from '../locales/en'

export function LanguagePicker({ locale, label, onSelect }: { locale: Locale; label: Messages['language']; onSelect(locale: Locale): void }) {
  const [open, setOpen] = useState(false)
  const selected = languages.findIndex(option => option.code === locale)
  const [active, setActive] = useState(selected)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false)
        // Leave focus on the outside control if the pointer can activate one.
        if (document.activeElement === list.current) trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function show() {
    setActive(selected)
    setOpen(true)
  }

  function dismiss() {
    setOpen(false)
    trigger.current?.focus()
  }

  function choose(index: number) {
    dismiss()
    onSelect(languages[index].code)
  }

  return <div className="language-picker" ref={root}>
    <button type="button" className="button language-trigger" data-tour-target="language" ref={trigger} aria-label={`${label}: ${languages[selected].label}`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      onClick={() => open ? dismiss() : show()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          show()
        }
      }}>
      <Globe2 size={18} aria-hidden="true" />
      <span lang={locale}>{languages[selected].label}</span>
      <ChevronDown className="language-chevron" size={16} aria-hidden="true" />
    </button>
    <ul id={id} ref={list} className="language-list" role="listbox" aria-label={label} tabIndex={-1}
      data-open={open} aria-hidden={!open || undefined} inert={!open}
      aria-activedescendant={open ? `${id}-${active}` : undefined} onBlur={event => {
        if (!root.current?.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={event => {
        switch (event.key) {
          case 'ArrowDown': setActive(index => (index + 1) % languages.length); break
          case 'ArrowUp': setActive(index => (index + languages.length - 1) % languages.length); break
          case 'Home': setActive(0); break
          case 'End': setActive(languages.length - 1); break
          case 'Enter': case ' ': choose(active); break
          case 'Escape': dismiss(); break
          case 'Tab': trigger.current?.focus(); setOpen(false); return
          default: return
        }
        event.preventDefault()
      }}>
      {languages.map((option, index) => <li id={`${id}-${index}`} key={option.code} role="option"
        aria-selected={option.code === locale} data-active={active === index} lang={option.code}
        onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
        {option.label}{option.code === locale && <Check size={18} aria-hidden="true" />}
      </li>)}
    </ul>
  </div>
}
