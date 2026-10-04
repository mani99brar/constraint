import { Avatar } from './Avatar';
import { TokenMark } from './art';
import type { SeatView } from './seats';

/**
 * One seat beside the board (PRD U2, I3): the avatar, the name, the token mark, the tokens left out
 * of 8 and the score of the sitting. The seat to move is lit in its player's colour and labelled; the
 * other is dimmed. Not interactive.
 */
export function Seat({ view }: { view: SeatView }) {
  const { player, number } = view;
  return (
    <section
      className={`seat seat-p${number}${view.lit ? ' lit' : ' dimmed'}`}
      aria-labelledby={`seat-${player}-name`}
      data-testid={`seat-${player}`}
      data-player={player}
      data-lit={view.lit}
      data-expression={view.expression}
      data-tokens-left={view.tokensLeft}
      data-score={view.score}
    >
      <Avatar player={player} expression={view.expression} />
      <div className="seat-info">
        <h2 className="seat-name" id={`seat-${player}-name`} data-testid={`seat-${player}-name`}>
          {view.name}
        </h2>
        <p className={`seat-status${view.status ? '' : ' empty'}`} data-testid={`seat-${player}-status`}>
          {view.status}
        </p>
      </div>
      <dl className="seat-stats">
        <div className="seat-tokens" data-testid={`seat-${player}-tokens`}>
          <dt>
            <span className={`count-token p${number}`} aria-hidden="true">
              <TokenMark player={player} />
            </span>
            <span className="visually-hidden">Tokens left</span>
          </dt>
          <dd aria-label={view.tokensLabel}>
            {view.tokensLeft}/{view.tokensTotal}
          </dd>
        </div>
        <div className="seat-score" data-testid={`seat-${player}-score`}>
          <dt>Wins</dt>
          <dd>{view.score}</dd>
        </div>
      </dl>
    </section>
  );
}
