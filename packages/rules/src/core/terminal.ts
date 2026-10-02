import { SQUARES } from '../api/board';
import { PLAYERS, type PlayerId } from '../api/fighters';
import type { MatchResult, MatchState } from '../api/state';
import { listLegalActions } from './legality';
import { fightersOf } from './queries';

/** Whether all of a player's fighters are deployed and fill one 2×2 square (spec §10). */
export function completesSquare(state: MatchState, player: PlayerId): boolean {
  const fighters = fightersOf(state, player);
  if (fighters.length !== state.preset.rosterSize) return false;
  const cells = new Set(fighters.map((fighter) => fighter.cell));
  if (cells.has(null)) return false;
  return SQUARES.some((square) => square.every((cell) => cells.has(cell)));
}

/** The objective check after a fully resolved action, for both players (spec §10, §11 step 7). */
export function objectiveResult(state: MatchState): MatchResult | null {
  const complete = PLAYERS.filter((player) => completesSquare(state, player));
  if (complete.length === 2) return { kind: 'draw', reason: 'simultaneous-objective' };
  if (complete.length === 1) return { kind: 'win', winner: complete[0]!, reason: 'objective' };
  return null;
}

/** Blockade (spec §11 step 10): the active player with no legal action loses. */
export function blockadeResult(state: MatchState): MatchResult | null {
  if (listLegalActions(state).length > 0) return null;
  return { kind: 'win', winner: state.activePlayer === 'A' ? 'B' : 'A', reason: 'blockade' };
}
