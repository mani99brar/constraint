import { adjacentCells, ALL_CELLS, areAdjacent, isCellId, isEdgeCell, tileMatches, type CellId } from '../api/board';
import type { Action, ActionRefusal } from '../api/actions';
import type { AbilityContext } from '../api/abilities';
import type { FighterState, MatchState } from '../api/state';
import { ABILITY_MODULES } from '../abilities/registry';
import { fighterAt, findFighter, fightersOf } from './queries';

export function abilityContext(state: MatchState, actor: FighterState): AbilityContext {
  return { state, actor, preset: state.preset };
}

/** The refusal for a destination cell that a deploy or move enters, or null when it is allowed. */
function destinationRefusal(state: MatchState, cell: CellId): ActionRefusal | null {
  if (fighterAt(state, cell)) return { code: 'cell-occupied', cell };
  const tile = state.board[cell];
  if (state.constraint && !tileMatches(tile, state.constraint)) {
    return { code: 'no-match', cell, tile, constraint: state.constraint };
  }
  return null;
}

/**
 * Validates one action against the pre-action state (spec §11). Returns a structured refusal,
 * or null when the action is legal.
 */
export function validateAction(state: MatchState, action: Action): ActionRefusal | null {
  if (state.result) return { code: 'match-over' };
  const fighter = findFighter(state, action.fighter);
  if (!fighter) return { code: 'unknown-fighter', fighter: action.fighter };
  if (fighter.owner !== state.activePlayer) {
    return { code: 'not-your-fighter', fighter: fighter.id, activePlayer: state.activePlayer };
  }
  const target = action.kind === 'recharge' ? null : action.kind === 'ability' ? action.target : action.cell;
  if (target !== null && !isCellId(target)) return { code: 'unknown-cell', cell: target };

  // Opening (spec §5 step 7): deploy onto an outside-edge cell, with no constraint yet.
  if (state.constraint === null) {
    if (action.kind !== 'deploy') return { code: 'opening-must-deploy' };
    if (fighter.cell !== null) return { code: 'not-in-reserve', fighter: fighter.id };
    if (!isEdgeCell(action.cell)) return { code: 'not-edge-cell', cell: action.cell };
    return destinationRefusal(state, action.cell);
  }

  switch (action.kind) {
    case 'deploy':
      if (fighter.cell !== null) return { code: 'not-in-reserve', fighter: fighter.id };
      return destinationRefusal(state, action.cell);
    case 'move':
      if (fighter.cell === null) return { code: 'not-deployed', fighter: fighter.id };
      if (fighter.lock) return { code: 'fighter-locked', fighter: fighter.id };
      if (!areAdjacent(fighter.cell, action.cell)) return { code: 'not-adjacent', from: fighter.cell, to: action.cell };
      return destinationRefusal(state, action.cell);
    case 'recharge': {
      if (fighter.cell === null) return { code: 'not-deployed', fighter: fighter.id };
      if (fighter.lock) return { code: 'fighter-locked', fighter: fighter.id };
      if (fighter.charge === 1) return { code: 'already-charged', fighter: fighter.id };
      if (state.recharges[fighter.owner] <= 0) return { code: 'no-recharges-left', player: fighter.owner };
      const tile = state.board[fighter.cell];
      if (!tileMatches(tile, state.constraint)) {
        return { code: 'no-match', cell: fighter.cell, tile, constraint: state.constraint };
      }
      return null;
    }
    case 'ability': {
      if (fighter.cell === null) return { code: 'not-deployed', fighter: fighter.id };
      if (fighter.lock) return { code: 'fighter-locked', fighter: fighter.id };
      if (fighter.charge === 0) return { code: 'no-charge', fighter: fighter.id };
      const targets = ABILITY_MODULES[fighter.type].targets(abilityContext(state, fighter));
      if (!targets.includes(action.target)) return { code: 'invalid-target', fighter: fighter.id, target: action.target };
      return null;
    }
  }
}

/**
 * Every legal action of the active player, one entry per concrete choice: deploy and move per
 * fighter and cell, ability per actor and target cell, recharge per fighter (`paper-test-01.md`).
 */
export function listLegalActions(state: MatchState): Action[] {
  if (state.result) return [];
  const candidates: Action[] = [];
  for (const fighter of fightersOf(state, state.activePlayer)) {
    if (fighter.cell === null) {
      for (const cell of ALL_CELLS) candidates.push({ kind: 'deploy', fighter: fighter.id, cell });
      continue;
    }
    for (const cell of adjacentCells(fighter.cell)) candidates.push({ kind: 'move', fighter: fighter.id, cell });
    candidates.push({ kind: 'recharge', fighter: fighter.id });
    if (fighter.charge === 1 && !fighter.lock) {
      for (const target of ABILITY_MODULES[fighter.type].targets(abilityContext(state, fighter))) {
        candidates.push({ kind: 'ability', fighter: fighter.id, target });
      }
    }
  }
  return candidates.filter((action) => validateAction(state, action) === null);
}
