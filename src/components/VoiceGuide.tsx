import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AudioLines, LocateFixed, Volume2 } from 'lucide-react'
import { money } from '../locales'
import type { Locale } from '../locales'
import { onboarding, tourSteps } from '../locales/onboarding'
import type { ToolMessages } from '../locales/wageTools'
import type { Messages } from '../locales/en'
import type { PlaybackResult } from '../services/readAloud'

export function VoiceGuide({ w, locale, onStart, onDismiss }: {
  w: ToolMessages; locale: Locale; onStart(trigger: HTMLButtonElement): void; onDismiss(): void
}) {
  return <aside className="panel voice-guide" aria-labelledby="voice-guide">
    <div className="guide-heading">
      <h2 id="voice-guide"><AudioLines size={20} aria-hidden="true" />{w.guide}</h2>
      <div className="guide-actions">
        <button className="button" type="button" onClick={onDismiss}>{w.guideSkip}</button>
        <button className="button primary" type="button" onClick={event => onStart(event.currentTarget)}>{onboarding(locale).start}</button>
      </div>
    </div>
  </aside>
}

function revealTarget(rect: DOMRect, panelTop: number) {
  const safeTop = 14 + (window.visualViewport?.offsetTop ?? 0)
  const safeBottom = panelTop - 14
  if (!rect.height || (rect.top >= safeTop && rect.bottom <= safeBottom)) return
  const top = safeTop + Math.max(0, (safeBottom - safeTop - rect.height) / 2)
  window.scrollBy({ top: Math.round(rect.top - top), behavior: 'instant' })
}

export function GuidedTour({ index, locale, example, t, playback, busy, onReplay, onMove, onExit }: {
  index: number; locale: Locale; example: string; t: Messages; playback?: PlaybackResult; busy: boolean
  onReplay(): void; onMove(index: number): void; onExit(outcome: 'completed' | 'skipped'): void
}) {
  const step = tourSteps[index]
  const m = onboarding(locale)
  const [title, instruction] = m.steps[step]
  const format = new Intl.NumberFormat(locale)
  const progress = m.progress.replace('{step}', format.format(index + 1)).replace('{total}', format.format(tourSteps.length))
  const heading = useRef<HTMLHeadingElement>(null)
  const card = useRef<HTMLElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number }>()
  const last = index === tourSteps.length - 1

  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const target = document.querySelector<HTMLElement>(`[data-tour-target="${step}"]`)
    const panel = card.current
    if (!panel) return
    let frame = 0

    function update(reveal: boolean) {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!panel) return
        const panelBox = panel.getBoundingClientRect()
        document.documentElement.style.setProperty('--tour-space', `${Math.ceil(window.innerHeight - panelBox.top + 14)}px`)
        if (!target) { setBox(undefined); return }
        if (reveal) revealTarget(target.getBoundingClientRect(), panelBox.top)
        const rect = target.getBoundingClientRect()
        setBox({ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 })
      })
    }

    const scroll = () => update(false)
    const resize = () => update(true)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(panel)
    if (target) observer?.observe(target)
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', scroll)
    resize()
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('scroll', scroll)
      document.documentElement.style.removeProperty('--tour-space')
    }
  }, [step])

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented &&
        !document.querySelector('.language-trigger[aria-expanded="true"]')) onExit('skipped')
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onExit])

  function focusTarget() {
    const target = document.querySelector<HTMLElement>(`[data-tour-target="${step}"]`)
    const control = target?.matches('button') ? target : target?.querySelector<HTMLElement>('button')
    const bounds = target?.getBoundingClientRect()
    if (bounds) revealTarget(bounds, card.current?.getBoundingClientRect().top ?? window.innerHeight)
    control?.focus({ preventScroll: true })
  }

  return <>
    <div className={box && step !== 'review' ? 'tour-spotlight' : 'tour-dim'} data-target={step}
      style={step !== 'review' ? box : undefined} aria-hidden="true" />
    <aside className="tour-panel panel" data-step={step} ref={card} aria-labelledby="tour-title">
      <div className="tour-toolbar">
        <div className="tour-progress">
          <div role="progressbar" aria-label={progress} aria-valuemin={0} aria-valuemax={tourSteps.length}
            aria-valuenow={index + 1} className="tour-segments">
            {tourSteps.map((item, position) => <span key={item} aria-hidden="true"
              data-state={position === index ? 'current' : position < index ? 'completed' : 'remaining'} />)}
          </div>
          <span aria-hidden="true">{progress}</span>
        </div>
        {step !== 'review' && <button className="button tour-icon" type="button" aria-label={m.focusTarget} title={m.focusTarget}
          onClick={focusTarget}><LocateFixed size={20} aria-hidden="true" /></button>}
        <button className="button tour-icon" type="button" disabled={busy} aria-label={m.replay} title={m.replay}
          onClick={onReplay}><Volume2 size={20} aria-hidden="true" /></button>
      </div>
      <h2 id="tour-title" ref={heading} tabIndex={-1}>{title}</h2>
      <p>{instruction}</p>
      {step === 'mic' && <p className="tour-example">{m.example} <q>{example}</q></p>}
      {step === 'review' && <div className="tour-preview">
        <p>{m.preview}</p>
        <dl>
          <div><dt>{t.worksite}</dt><dd>{m.previewSite}</dd></div>
          <div><dt>{t.amount}</dt><dd>{money(70_000, locale)}</dd></div>
        </dl>
      </div>}
      <p role="status" className="tour-audio-status">
        {playback === 'unavailable' ? m.unavailable : playback === 'failed' ? m.tryAudio : null}
      </p>
      <div className="guide-actions tour-navigation">
        <button className="button tour-skip" type="button" onClick={() => onExit('skipped')}>{m.skip}</button>
        <button className="button" type="button" disabled={index === 0} onClick={() => onMove(index - 1)}>{m.previous}</button>
        {last ? <button className="button primary" type="button" onClick={() => onExit('completed')}>{m.finish}</button> :
          <button className="button primary" type="button" onClick={() => onMove(index + 1)}>{m.next}</button>}
      </div>
    </aside>
  </>
}
