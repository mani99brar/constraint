import { ALL_CELLS, cellIndex, isCellId, isEdgeCell, LINES, SQUARES, tilesMatch, type CellId } from './board';
import { seededSetup } from './random';
import { otherPlayer, type GameResult, type GameState, type Player, type TakeRefusal, type TakeResult } from './state';

export interface NewGameInput {
  /** A non-negative 32-bit integer; it decides the board shuffle (spec §2). */
  readonly seed: number;
  /** The starting player; when omitted the seed chooses one (spec §5). */
  readonly starter?: Player;
}

export class InvalidSeedError extends Error {
  constructor(seed: number) {
    super(`seed must be an integer from 0 to 4294967295, got ${seed}`);
  }
}

export function isValidSeed(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
}

/** Setup (spec §2): the seeded board, every tile on it, and the starting player to take the opening tile. */
export function newGame({ seed, starter }: NewGameInput): GameState {
  if (!isValidSeed(seed)) throw new InvalidSeedError(seed);
  const setup = seededSetup(seed);
  const first = starter ?? setup.starter;
  return {
    seed,
    board: setup.board,
    tokens: ALL_CELLS.map(() => null),
    starter: first,
    toMove: first,
    lastTile: null,
    takes: [],
    result: null,
  };
}

/** Why `cell` is not a legal take for the player to move, or null when it is (spec §3). */
export function validateTake(state: GameState, cell: string): TakeRefusal | null {
  if (state.result) return { code: 'game-over' };
  if (!isCellId(cell)) return { code: 'unknown-cell', cell };
  const index = cellIndex(cell);
  if (state.tokens[index] !== null) return { code: 'cell-taken', cell };
  if (state.lastTile === null) return isEdgeCell(cell) ? null : { code: 'not-edge', cell };
  const tile = state.board[index]!;
  return tilesMatch(tile, state.lastTile) ? null : { code: 'no-match', cell, tile, lastTile: state.lastTile };
}

/** Every legal take for the player to move, in `ALL_CELLS` order; empty once the game has ended. */
export function legalTakes(state: GameState): CellId[] {
  return ALL_CELLS.filter((cell) => validateTake(state, cell) === null);
}

function shapeOf(tokens: GameState['tokens'], player: Player): GameResult | null {
  const owns = (cell: CellId) => tokens[cellIndex(cell)] === player;
  const line = LINES.find((cells) => cells.every(owns));
  if (line) return { kind: 'win', winner: player, by: 'line', cells: line };
  const square = SQUARES.find((cells) => cells.every(owns));
  if (square) return { kind: 'win', winner: player, by: 'square', cells: square };
  return null;
}

/**
 * The active player takes the tile at `cell` and places a token there (spec §3), then the end checks run in
 * spec §4 order: a shape for the taker, a full board, a blockade of the next player.
 */
export function take(state: GameState, cell: string): TakeResult {
  const refusal = validateTake(state, cell);
  if (refusal) return { ok: false, refusal };
  const taken = cell as CellId;
  const index = cellIndex(taken);
  const player = state.toMove;
  const tokens = state.tokens.map((token, i) => (i === index ? player : token));
  const placed: GameState = {
    ...state,
    tokens,
    toMove: otherPlayer(player),
    lastTile: state.board[index]!,
    takes: [...state.takes, taken],
  };
  const shape = shapeOf(tokens, player);
  if (shape) return { ok: true, state: { ...placed, result: shape } };
  if (tokens.every((token) => token !== null)) return { ok: true, state: { ...placed, result: { kind: 'draw', by: 'full-board' } } };
  if (legalTakes(placed).length === 0) return { ok: true, state: { ...placed, result: { kind: 'win', winner: player, by: 'blockade' } } };
  return { ok: true, state: placed };
}

/** The token on `cell`, or null while its tile is on the board. */
export function tokenAt(state: GameState, cell: CellId): Player | null {
  return state.tokens[cellIndex(cell)] ?? null;
}

/** The tile laid on `cell` at setup. */
export function tileAt(state: GameState, cell: CellId) {
  return state.board[cellIndex(cell)]!;
}
