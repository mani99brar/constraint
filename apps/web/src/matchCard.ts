import type { CellId, GameState, Terrain, TileSymbol } from '@okiya/game';
import { tileName } from './text';

/** The Match card next to the board (PRD I1): the tile the next take must match. */
export interface MatchCardModel {
  /** Null at the opening, when any edge tile may be taken. */
  readonly terrain: Terrain | null;
  readonly symbol: TileSymbol | null;
  /** "Desert–Moon", or "Any edge tile" at the opening. */
  readonly text: string;
  /** The accessible name: "Tile to match: Desert–Moon" or "Tile to match: any edge tile". */
  readonly label: string;
  /** After a blockade, that no tile matches (PRD U10): "No tile matches Desert–Moon"; else null. */
  readonly blocked: string | null;
  /** The same in one short line for a phone's fixed card ("No match"); else null. */
  readonly blockedShort: string | null;
  /** The cell the tile was taken from; null at the opening. */
  readonly cell: CellId | null;
  /** The number of takes, which keys the card's crossfade. */
  readonly takes: number;
  /** The game has ended: the tile shown is the last one taken, not one the next take must match. */
  readonly ended: boolean;
}

export const OPENING_LABEL = 'Any edge tile';
export const BLOCKED_SHORT = 'No match';

export function matchCardModel(state: Pick<GameState, 'lastTile' | 'takes'> & Partial<Pick<GameState, 'result'>>): MatchCardModel {
  const { lastTile, takes } = state;
  const cell = takes[takes.length - 1] ?? null;
  if (!lastTile) return { terrain: null, symbol: null, text: OPENING_LABEL, label: 'Tile to match: any edge tile', blocked: null, blockedShort: null, cell, takes: takes.length, ended: false };
  const name = tileName(lastTile);
  const blocked = state.result?.kind === 'win' && state.result.by === 'blockade' ? `No tile matches ${name}` : null;
  return { terrain: lastTile.terrain, symbol: lastTile.symbol, text: name, label: blocked ?? `Tile to match: ${name}`, blocked, blockedShort: blocked ? BLOCKED_SHORT : null, cell, takes: takes.length, ended: Boolean(state.result) && !blocked };
}
