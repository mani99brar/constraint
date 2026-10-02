import { adjacentCells, cellAt, cellColumn, cellRow, tileMatches, type CellId } from '../api/board';
import type { AbilityContext } from '../api/abilities';
import type { FighterState, MatchState } from '../api/state';

// Geometry and occupancy shared by the ability modules. Modules read the state and return
// effects; they never change the state themselves.

export function fighterAt(state: MatchState, cell: CellId): FighterState | undefined {
  return state.fighters.find((fighter) => fighter.cell === cell);
}

/** Whether the tile at a cell matches the stored constraint (spec §6). */
export function cellMatches(state: MatchState, cell: CellId): boolean {
  return state.constraint !== null && tileMatches(state.board[cell], state.constraint);
}

/** The actor's cell; targets are only asked for deployed actors. */
export function actorCell(context: AbilityContext): CellId {
  const cell = context.actor.cell;
  if (cell === null) throw new Error(`${context.actor.id} is not deployed`);
  return cell;
}

/** Whether the actor's own tile matches, the activation gate of several abilities (spec §9). */
export function actorMatches(context: AbilityContext): boolean {
  return context.actor.cell !== null && cellMatches(context.state, context.actor.cell);
}

/** The cell `steps` cells from `from`, in the direction from `from` towards `toward`, or null off the board. */
export function cellBeyond(from: CellId, toward: CellId, steps: number): CellId | null {
  const dRow = Math.sign(cellRow(toward) - cellRow(from));
  const dColumn = Math.sign(cellColumn(toward) - cellColumn(from));
  return cellAt(cellRow(from) + dRow * steps, cellColumn(from) + dColumn * steps);
}

/** Cells exactly two away along a row or column, each with the cell between (spec §9 Puller). */
export function cellsTwoAway(cell: CellId): { readonly target: CellId; readonly between: CellId }[] {
  return adjacentCells(cell).flatMap((between) => {
    const target = cellBeyond(cell, between, 2);
    return target ? [{ target, between }] : [];
  });
}

/** Anchor protection blocks displacement forced by the protected fighter's enemy only (spec §9). */
export function shieldedFrom(context: AbilityContext, target: FighterState): boolean {
  return target.owner !== context.actor.owner && target.protection !== null;
}

/** Throws when `resolve` is asked for a target `targets` does not offer; core validates first. */
export function requireTarget(module: string, targets: readonly CellId[], target: CellId): void {
  if (!targets.includes(target)) throw new Error(`${module}: ${target} is not a legal target`);
}
