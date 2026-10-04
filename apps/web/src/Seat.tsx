import { Avatar } from './Avatar';
import { TokenMark } from './art';
import type { SeatView } from './seats';

/**
 * One seat's slim nameplate (PRD U2, I3, U9): the avatar with its face and reaction beside two rows, the
 * name with the token mark and the tokens left out of 8 on top and a one-line status under them, which
 * has the plate's full text width. The seat to move is lit in its player's colour and labelled; the other
 * is dimmed. In a timed game the player's clock sits beside the name. The score of the sitting is not
 * here: it is in the scoreboard row. Not interactive.
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
      data-reaction={view.reaction ?? undefined}
      data-reaction-key={view.reactionKey}
      data-tokens-left={view.tokensLeft}
      data-score={view.score}
      data-timed={view.clock !== null || undefined}
    >
      <Avatar player={player} expression={view.expression} reaction={view.reaction} reactionKey={view.reactionKey} />
      <h2 className="seat-name" id={`seat-${player}-name`} data-testid={`seat-${player}-name`}>
        {view.name}
      </h2>
      {view.clock && (
        <p
          className={`seat-clock${view.clock.running ? ' running' : ''}${view.clock.low ? ' low' : ''}`}
          role="timer"
          aria-label={view.clock.label}
          data-testid={`seat-${player}-clock`}
          data-ms={view.clock.ms}
          data-running={view.clock.running}
          data-low={view.clock.low}
        >
          <svg className="clock-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 6v3.2l2 1.3M6.5 1.8h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {view.clock.text}
        </p>
      )}
      <p className="seat-tokens" data-testid={`seat-${player}-tokens`}>
        <span className={`count-token p${number}`} aria-hidden="true">
          <TokenMark player={player} />
        </span>
        <span aria-label={view.tokensLabel}>
          {view.tokensLeft}/{view.tokensTotal}
        </span>
      </p>
      <p className={`seat-status${view.status ? '' : ' empty'}`} data-testid={`seat-${player}-status`}>
        {view.status}
      </p>
    </section>
  );
}
