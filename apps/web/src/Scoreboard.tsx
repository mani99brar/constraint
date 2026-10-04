import type { ReactNode } from 'react';
import { TokenMark } from './art';
import type { ScoreboardModel } from './score';

/**
 * The scoreboard row above the board (PRD U2, I1, P3): Player 1's score on the left of the Match card and
 * Player 2's on the right, each that seat's wins in the sitting in its player's colour with its token mark,
 * and the draws small under the Match card, their line kept but hidden at zero so the row never changes
 * height. Its accessible name reads the score. Not interactive.
 */
export function Scoreboard({ model, children }: { model: ScoreboardModel; children: ReactNode }) {
  const [one, two] = model.sides;
  const side = ({ player, number, wins }: typeof one) => (
    <p className={`score-side score-p${number}`} data-testid={`score-${player}`} data-player={player} data-wins={wins} aria-hidden="true">
      <span className={`count-token p${number}`}>
        <TokenMark player={player} />
      </span>
      <span className="score-wins">{wins}</span>
    </p>
  );
  return (
    <section className="scoreboard" role="group" aria-label={model.label} data-testid="scoreboard" data-a={one.wins} data-b={two.wins} data-draws={model.draws}>
      {side(one)}
      <div className="score-centre">
        {children}
        <p className={`score-draws${model.drawsText ? '' : ' empty'}`} data-testid="score-draws" aria-hidden="true">
          {model.drawsText}
        </p>
      </div>
      {side(two)}
    </section>
  );
}
