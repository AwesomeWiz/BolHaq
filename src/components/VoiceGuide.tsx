import { AudioLines } from 'lucide-react'
import type { ToolMessages } from '../locales/wageTools'

export function VoiceGuide({ w, examples, finished, onDismiss }: {
  w: ToolMessages; examples: readonly string[]; finished: boolean; onDismiss(): void
}) {
  return <aside className="panel voice-guide" aria-labelledby="voice-guide">
    <div className="guide-heading">
      <h2 id="voice-guide"><AudioLines size={20} aria-hidden="true" />{w.guide}</h2>
      <button className="button" type="button" onClick={onDismiss}>{finished ? w.guideDone : w.guideSkip}</button>
    </div>
    <ol>
      <li>{w.guideLanguage}</li>
      <li>{w.guideMic}</li>
      <li>{w.guideSite}<q>{examples[4]}</q></li>
      <li>{w.guideWork}<q>{examples[0]}</q><q>{examples[3]}</q></li>
    </ol>
  </aside>
}
