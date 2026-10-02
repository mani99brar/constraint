import type { ObjectiveId } from '@okiya/rules';
import { guideSteps } from './guide';

/** The short first-match guide (PRD U7): matching, the fighters and the objective. */
export function Guide({ objective, onDismiss }: { objective: ObjectiveId; onDismiss: () => void }) {
  return (
    <aside id="guide" className="guide" aria-labelledby="guide-title" data-testid="guide">
      <div className="guide-head">
        <h2 id="guide-title">How to play</h2>
        <button type="button" onClick={onDismiss}>
          Got it, hide the guide
        </button>
      </div>
      <ol className="guide-steps">
        {guideSteps(objective).map((step) => (
          <li key={step.id} data-step={step.id}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
