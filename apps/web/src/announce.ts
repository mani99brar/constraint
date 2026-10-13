import { otherPlayer, tileAt, type GameState } from '@okiya/game';
import { HUMAN } from './match';
import { shortName, type GameMode } from './mode';
import { turnLabel } from './seats';
import { resultSummary, tileName } from './text';

/**
 * The newest take in words, for the announcements, which keep the cell for screen readers (PRD U3, I3):
 * "Bot took D3, Desert–Star", "You took A1, Forest–Sun" or "Player 2 took B2, Water–Moon"; null before the first.
 */
export function takeText(state: GameState, mode: GameMode): string | null {
  const cell = state.takes[state.takes.length - 1];
  if (!cell) return null;
  // The engine passes the turn on every take, the last one included.
  const taker = otherPlayer(state.toMove);
  return `${shortName(mode, taker)} took ${cell}, ${tileName(tileAt(state, cell))}`;
}

/** The newest take for the bot's toast, naming the tile and no coordinates, which the board no longer shows: "Bot took Desert–Star"; null before the first. */
export function takeToastText(state: GameState, mode: GameMode): string | null {
  const cell = state.takes[state.takes.length - 1];
  return cell ? `${shortName(mode, otherPlayer(state.toMove))} took ${tileName(tileAt(state, cell))}` : null;
}

function starterLine(state: GameState, mode: GameMode): string {
  if (mode.kind === 'two-player') return `${shortName(mode, state.starter)} starts`;
  return state.starter === HUMAN ? 'You start' : 'The bot starts';
}

/**
 * The `aria-live` line for the state on screen (PRD I3): who starts and whose move it is at the
 * opening, then the newest take with whose move is next, or with the result once the game has ended.
 */
export function turnAnnouncement(state: GameState, mode: GameMode): string {
  const taken = takeText(state, mode);
  if (state.result) return `${taken ? `${taken}. ` : ''}${resultSummary(state.result, mode)}.`;
  const turn = turnLabel(state, mode)!;
  return taken ? `${taken}. ${turn}.` : `${starterLine(state, mode)}. ${turn}.`;
}
