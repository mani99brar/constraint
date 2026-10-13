import type { ReactNode } from 'react';
import type { ScoreboardModel } from './score';

/**
 * The row above the board (PRD U2, I1, P3): the Match card, with the draws small under it, their line
 * kept but hidden at zero so the row never changes height. Each seat's wins are on its own nameplate;
 * this group's accessible name reads the whole score. Not interactive.
 */
export function Scoreboard({ model, children }: { model: ScoreboardModel; children: ReactNode }) {
  const [one, two] = model.sides;
  return (
    <section className="scoreboard" role="group" aria-label={model.label} data-testid="scoreboard" data-a={one.wins} data-b={two.wins} data-draws={model.draws}>
      <div className="score-centre">
        {children}
        <p className={`score-draws${model.drawsText ? '' : ' empty'}`} data-testid="score-draws" aria-hidden="true">
          {model.drawsText}
        </p>
      </div>
    </section>
  );
}
