import type { CellId } from '../api/board';
import { isFighterType, type FighterId, type FighterType, type PlayerId } from '../api/fighters';
import type { FighterState, MatchState } from '../api/state';

export function findFighter(state: Pick<MatchState, 'fighters'>, id: string): FighterState | undefined {
  return state.fighters.find((fighter) => fighter.id === id);
}

export function fighterAt(state: Pick<MatchState, 'fighters'>, cell: CellId): FighterState | undefined {
  return state.fighters.find((fighter) => fighter.cell === cell);
}

export function fightersOf(state: Pick<MatchState, 'fighters'>, owner: PlayerId): FighterState[] {
  return state.fighters.filter((fighter) => fighter.owner === owner);
}

/** The type named by a fighter id such as `B:Trapper`. */
export function fighterTypeOf(id: FighterId): FighterType {
  const type = id.slice(id.indexOf(':') + 1);
  if (!isFighterType(type)) throw new Error(`Malformed fighter id ${id}`);
  return type;
}
