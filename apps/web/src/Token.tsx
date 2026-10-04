import type { Player } from '@okiya/game';
import { TokenMark } from './art';

/**
 * A round player token (PRD U1): Player 1's solid-rimmed with a ring, Player 2's notch-rimmed with a
 * diamond, in two colours, so colour is never the only signal. Its words are in the cell's name.
 */
export function Token({ player }: { player: Player }) {
  return (
    <span className={`token p${player === 'A' ? 1 : 2}`} data-testid="token" data-owner={player} data-rim={player === 'A' ? 'solid' : 'notched'} aria-hidden="true">
      <TokenMark player={player} />
    </span>
  );
}
