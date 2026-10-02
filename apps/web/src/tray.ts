import type { PlayerId, PlayerView } from '@okiya/rules';
import { tokenState, type TokenState } from './tokens';

/**
 * The two piece trays (PRD T2): the player's unplaced tokens face up, in the view's order, and the
 * bot's as a count of face-down tokens, since the view never says which fighters they are (PRD I4).
 * A tray is hidden once it is empty.
 */
export interface TrayContents {
  readonly own: readonly TokenState[];
  readonly botCount: number;
  readonly showOwn: boolean;
  readonly showBot: boolean;
}

export function trayContents(view: Pick<PlayerView, 'fighters' | 'reserveCounts'>, human: PlayerId): TrayContents {
  const bot: PlayerId = human === 'A' ? 'B' : 'A';
  const own = view.fighters.filter((fighter) => fighter.owner === human && fighter.cell === null).map((fighter) => tokenState(fighter, human));
  const botCount = view.reserveCounts[bot];
  return { own, botCount, showOwn: own.length > 0, showBot: botCount > 0 };
}
