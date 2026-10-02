import { ALL_CELLS } from '../api/board';
import type { MatchState, StateSignature } from '../api/state';

/**
 * Canonical signature of the full start-of-turn gameplay state (spec §12). Statuses count by
 * remaining duration, not absolute turn numbers; narration, the turn counter and history are left out.
 */
export function canonicalSignature(state: MatchState): StateSignature {
  const fighters = [...state.fighters]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((fighter) => [
      fighter.id,
      fighter.cell,
      fighter.charge,
      fighter.lock ? fighter.lock.expiresAfterTurn - state.turn : null,
      fighter.protection ? fighter.protection.expiresAfterTurn - state.turn : null,
    ]);
  const traps = state.traps.map((trap) => `${trap.owner}@${trap.cell}`).sort();
  return JSON.stringify([
    state.activePlayer,
    state.constraint,
    ALL_CELLS.map((cell) => state.board[cell]),
    fighters,
    state.recharges,
    traps,
    state.objectives,
  ]);
}
