import { FIGHTER_TYPES, fighterId, opponentOf, type PlayerId } from '../api/fighters';
import type { FighterState, MatchState, TrapRecord } from '../api/state';
import type { PlayerView } from '../api/view';
import { createRng } from './random';

function bySide<T>(viewer: PlayerId, own: T, other: T): Record<PlayerId, T> {
  return viewer === 'A' ? { A: own, B: other } : { A: other, B: own };
}

/**
 * Builds a full state from one player's view, filling what the view hides with placeholders:
 * the opponent's reserve becomes fighter types it has not shown, its objective the preset's
 * first, and it has no traps. The legal-action listing and action application accept the
 * result, so the bot can look ahead without reading the real state.
 */
export function hypotheticalState(view: PlayerView): MatchState {
  const viewer = view.viewer;
  const opponent = opponentOf(viewer);
  const shown = new Set(view.fighters.filter((fighter) => fighter.owner === opponent).map((fighter) => fighter.type));
  const placeholderTypes = FIGHTER_TYPES.filter((type) => !shown.has(type)).slice(0, view.reserveCounts[opponent]);
  const placeholders: FighterState[] = placeholderTypes.map((type) => ({
    id: fighterId(opponent, type),
    owner: opponent,
    type,
    cell: null,
    charge: 1,
    lock: null,
    protection: null,
  }));
  const fighters = [...view.fighters, ...placeholders];
  const trapHistory: TrapRecord[] = view.ownTraps.map((trap) => ({
    ...trap,
    source: 'setup',
    placedOnTurn: 0,
    placedBy: null,
    fate: { kind: 'live' },
  }));
  const placeholderObjective = view.preset.objectivePool[0] ?? view.objective;
  const rosterOf = (owner: PlayerId) => fighters.filter((fighter) => fighter.owner === owner).map((fighter) => fighter.type);
  return {
    preset: view.preset,
    seed: view.seed,
    scenario: null,
    board: view.board,
    rng: createRng(view.seed),
    objectives: bySide(viewer, view.objective, placeholderObjective),
    setups: bySide(
      viewer,
      { roster: rosterOf(viewer), traps: view.ownTraps.map((trap) => trap.cell) },
      { roster: rosterOf(opponent), traps: [] },
    ),
    startingPlayer: view.startingPlayer,
    fighters,
    constraint: view.constraint,
    activePlayer: view.activePlayer,
    turn: view.turn,
    recharges: view.recharges,
    traps: view.ownTraps,
    trapHistory,
    inspections: view.inspections,
    history: [],
    repetition: [],
    result: view.result,
  };
}
