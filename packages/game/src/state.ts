import type { CellId, Tile } from './board';

export const PLAYERS = ['A', 'B'] as const;
export type Player = (typeof PLAYERS)[number];

export function otherPlayer(player: Player): Player {
  return player === 'A' ? 'B' : 'A';
}

export const TOKENS_PER_PLAYER = 8;

export type GameResult =
  | { readonly kind: 'win'; readonly winner: Player; readonly by: 'line' | 'square'; readonly cells: readonly CellId[] }
  | { readonly kind: 'win'; readonly winner: Player; readonly by: 'blockade' }
  | { readonly kind: 'draw'; readonly by: 'full-board' };

/**
 * The whole game, public to both players (spec §2). Plain serializable data; every array is indexed like
 * `ALL_CELLS`.
 */
export interface GameState {
  readonly seed: number;
  /** The tile laid on every cell at setup. A cell whose tile was taken keeps its entry here; `tokens` marks it. */
  readonly board: readonly Tile[];
  /** The token on every cell, or null while its tile is still on the board. */
  readonly tokens: readonly (Player | null)[];
  readonly starter: Player;
  /** The player to take next. After the game ends, the player who would have been next. */
  readonly toMove: Player;
  /** The tile taken on the previous turn (spec §3), or null before the opening take. */
  readonly lastTile: Tile | null;
  /** Every take so far, in order. */
  readonly takes: readonly CellId[];
  readonly result: GameResult | null;
}

export type TakeRefusal =
  | { readonly code: 'game-over' }
  | { readonly code: 'unknown-cell'; readonly cell: string }
  | { readonly code: 'cell-taken'; readonly cell: CellId }
  | { readonly code: 'not-edge'; readonly cell: CellId }
  | { readonly code: 'no-match'; readonly cell: CellId; readonly tile: Tile; readonly lastTile: Tile };

export type TakeResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly refusal: TakeRefusal };
