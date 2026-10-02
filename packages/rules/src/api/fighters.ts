// Fighter pool (spec §9) and the per-fighter data the content package describes.

export const FIGHTER_TYPES = [
  'Teleporter',
  'Pusher',
  'Swapper',
  'Upgrader',
  'TrapChecker',
  'Puller',
  'Anchor',
  'TerrainWeaver',
  'Trapper',
] as const;
export type FighterType = (typeof FIGHTER_TYPES)[number];

/** Fighters that force another fighter to move; a preset may cap them per roster (PRD §6). */
export const DISPLACER_TYPES: readonly FighterType[] = ['Pusher', 'Puller', 'Swapper'];

export type PlayerId = 'A' | 'B';
export const PLAYERS: readonly PlayerId[] = ['A', 'B'];

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'A' ? 'B' : 'A';
}

/** A fighter's id is its owner and type; a roster never holds the same type twice (spec §4). */
export type FighterId = `${PlayerId}:${FighterType}`;

export function fighterId(owner: PlayerId, type: FighterType): FighterId {
  return `${owner}:${type}`;
}

export function isFighterType(value: string): value is FighterType {
  return (FIGHTER_TYPES as readonly string[]).includes(value);
}

/** Static description of a fighter type, as typed data in `packages/content`. */
export interface FighterDefinition {
  readonly type: FighterType;
  readonly name: string;
  /** Abbreviation used in spec notation and the paper test ledger, for example `TP`. */
  readonly abbreviation: string;
  readonly displacer: boolean;
  readonly summary: string;
}

export type ObjectiveId = 'Square';

export interface ObjectiveDefinition {
  readonly id: ObjectiveId;
  readonly name: string;
  readonly summary: string;
}
