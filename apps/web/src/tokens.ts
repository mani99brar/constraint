import type { CellId, FighterId, FighterState, FighterType, PlayerId, Tile } from '@okiya/rules';
import { fighterAbbreviation, fighterName, tileName } from './text';

/**
 * Everything a fighter's token shows (PRD T5, I1): its owner, emblem, name or initials, charge,
 * lock and protection, and the accessible name that says the same in words (PRD U3).
 */
export interface TokenState {
  readonly id: FighterId;
  readonly type: FighterType;
  /** Whether the human owns it; the bot's tokens differ in colour, rim and name. */
  readonly own: boolean;
  readonly name: string;
  /** The short code shown when the token is too small for the name, for example "TP". */
  readonly initials: string;
  readonly cell: CellId | null;
  readonly charged: boolean;
  readonly locked: boolean;
  readonly protected: boolean;
  readonly label: string;
}

/**
 * A token's accessible name: owner, fighter, cell, charge, lock and protection, every one stated
 * even when absent, for example "Your Pusher on B3, charged, not locked, not protected".
 */
export function tokenAccessibleName(fighter: FighterState, human: PlayerId): string {
  const owner = fighter.owner === human ? 'Your' : "Bot's";
  const where = fighter.cell === null ? 'in your tray' : `on ${fighter.cell}`;
  return [
    `${owner} ${fighterName(fighter.type)} ${where}`,
    fighter.charge === 1 ? 'charged' : 'spent',
    fighter.lock ? 'locked' : 'not locked',
    fighter.protection ? 'protected' : 'not protected',
  ].join(', ');
}

export function tokenState(fighter: FighterState, human: PlayerId): TokenState {
  return {
    id: fighter.id,
    type: fighter.type,
    own: fighter.owner === human,
    name: fighterName(fighter.type),
    initials: fighterAbbreviation(fighter.type),
    cell: fighter.cell,
    charged: fighter.charge === 1,
    locked: fighter.lock !== null,
    protected: fighter.protection !== null,
    label: tokenAccessibleName(fighter, human),
  };
}

/** The accessible name of one of the bot's face-down tray tokens: it never says which fighter. */
export const FACE_DOWN_LABEL = "Bot's face-down token, in its tray";

/** Accessible name of a board cell: its id, tile, token and own trap, for example "B3, Water–Moon, Your Pusher on B3, …" (PRD U3). */
export function cellAccessibleName(
  cell: CellId,
  tile: Tile,
  fighter: FighterState | undefined,
  human: PlayerId,
  ownTrap: boolean,
  trapInspected = false,
): string {
  const parts = [cell, tileName(tile)];
  if (fighter) parts.push(tokenAccessibleName(fighter, human));
  if (ownTrap) parts.push(trapInspected ? `your trap, ${INSPECTED_TRAP}` : 'your trap');
  return parts.join(', ');
}

/** What an own trap the bot's Trap Checker inspected says: only the bot learned the result (spec §9). */
export const INSPECTED_TRAP = 'inspected by the bot, may have been removed';
