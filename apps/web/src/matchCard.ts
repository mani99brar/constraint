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
  /** The cell the tile was taken from, where it flies in from; null at the opening. */
  readonly cell: CellId | null;
  readonly takes: number;
}

export const OPENING_LABEL = 'Any edge tile';

export function matchCardModel(state: Pick<GameState, 'lastTile' | 'takes'>): MatchCardModel {
  const { lastTile, takes } = state;
  const cell = takes[takes.length - 1] ?? null;
  if (!lastTile) return { terrain: null, symbol: null, text: OPENING_LABEL, label: 'Tile to match: any edge tile', cell, takes: takes.length };
  return { terrain: lastTile.terrain, symbol: lastTile.symbol, text: tileName(lastTile), label: `Tile to match: ${tileName(lastTile)}`, cell, takes: takes.length };
}
