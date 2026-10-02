import {
  ALL_CELLS,
  LINES,
  SQUARES,
  cellIndex,
  legalTakes,
  newGame,
  take,
  tilesMatch,
  type CellId,
  type GameState,
  type Player,
  type Tile,
} from '@okiya/game';
import { analyzeTake, type Difficulty, type TakeAnalysis } from './take';

// Helpers for the bot's tests only; nothing in the bot imports this file. The reference solver below shares no
// code with the bot's solver (`solver.ts`), so the tests can hold one against the other.

/**
 * An independent exact solver on bitmasks: plain minimax with a memo of exact values and a stop on a found win,
 * keyed by player A's and player B's tokens rather than by the side to move. Values are 1 (win), 0 (draw) and
 * -1 (loss) for the player to take.
 */
export class ReferenceSolver {
  private readonly matching: number[];
  private readonly shapes: number[];
  private readonly memo = new Map<number, number>();

  constructor(board: readonly Tile[]) {
    this.matching = board.map((tile, i) => board.reduce((mask, other, j) => (j !== i && tilesMatch(tile, other) ? mask | (1 << j) : mask), 0));
    this.shapes = [...LINES, ...SQUARES].map((cells) => cells.map(cellIndex).reduce((mask, i) => mask + 2 ** i, 0));
  }

  /** The value of `state` for its player to take; the state must not have ended. */
  value(state: GameState): number {
    const { a, b, last } = this.masksOf(state);
    return this.node(a, b, state.toMove, last);
  }

  /** The value of every legal take of `state` for its player to take. */
  takeValues(state: GameState): Map<CellId, number> {
    const { a, b, last } = this.masksOf(state);
    const values = new Map<CellId, number>();
    for (const i of this.legal(a, b, last)) values.set(ALL_CELLS[i]!, this.afterTake(a, b, state.toMove, i));
    return values;
  }

  private masksOf(state: GameState): { a: number; b: number; last: number } {
    let a = 0;
    let b = 0;
    state.tokens.forEach((token, i) => {
      if (token === 'A') a |= 1 << i;
      if (token === 'B') b |= 1 << i;
    });
    const lastTile = state.lastTile;
    const last = lastTile === null ? -1 : state.board.findIndex((tile) => tile.terrain === lastTile.terrain && tile.symbol === lastTile.symbol);
    return { a, b, last };
  }

  private legal(a: number, b: number, last: number): number[] {
    const cells: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      if (((a | b) >> i) & 1) continue;
      const edge = i < 4 || i >= 12 || i % 4 === 0 || i % 4 === 3;
      if (last === -1 ? edge : (this.matching[last]! >> i) & 1) cells.push(i);
    }
    return cells;
  }

  /** The value for `mover` of taking cell `i`. */
  private afterTake(a: number, b: number, mover: Player, i: number): number {
    const nextA = mover === 'A' ? a | (1 << i) : a;
    const nextB = mover === 'B' ? b | (1 << i) : b;
    const mine = mover === 'A' ? nextA : nextB;
    if (this.shapes.some((shape) => (mine & shape) === shape)) return 1;
    if ((nextA | nextB) === 0xffff) return 0;
    if (this.legal(nextA, nextB, i).length === 0) return 1;
    return 0 - this.node(nextA, nextB, mover === 'A' ? 'B' : 'A', i);
  }

  private node(a: number, b: number, mover: Player, last: number): number {
    const key = ((a * 65536 + b) * 17 + last + 1) * 2 + (mover === 'A' ? 0 : 1);
    const known = this.memo.get(key);
    if (known !== undefined) return known;
    let best = -1;
    for (const i of this.legal(a, b, last)) {
      best = Math.max(best, this.afterTake(a, b, mover, i));
      if (best === 1) break;
    }
    this.memo.set(key, best);
    return best;
  }
}

/** The value of `state` for its player to take by brute force on the engine's `take()` and `legalTakes()`. */
export function bruteForceValue(state: GameState): number {
  let best = -1;
  for (const cell of legalTakes(state)) {
    best = Math.max(best, bruteForceTakeValue(state, cell));
    if (best === 1) break;
  }
  return best;
}

export function bruteForceTakeValue(state: GameState, cell: CellId): number {
  const next = after(state, cell);
  if (next.result === null) return 0 - bruteForceValue(next);
  if (next.result.kind === 'draw') return 0;
  return next.result.winner === state.toMove ? 1 : -1;
}

export function after(state: GameState, cell: CellId): GameState {
  const next = take(state, cell);
  if (!next.ok) throw new Error(`illegal take ${cell}: ${next.refusal.code}`);
  return next.state;
}

/** Whether taking `cell` ends the game in a win for the taker. */
export function winsAtOnce(state: GameState, cell: CellId): boolean {
  const result = after(state, cell).result;
  return result?.kind === 'win' && result.winner === state.toMove;
}

/** Whether, after `cell`, the opponent has a take that wins at once. */
export function opponentCanWinAtOnce(state: GameState, cell: CellId): boolean {
  const next = after(state, cell);
  return next.result === null && legalTakes(next).some((reply) => winsAtOnce(next, reply));
}

export interface PlayedTurn {
  readonly state: GameState;
  readonly difficulty: Difficulty;
  readonly analysis: TakeAnalysis;
}

export interface PlayedGame {
  readonly seed: number;
  readonly starter: Player;
  readonly players: Readonly<Record<Player, Difficulty>>;
  readonly turns: readonly PlayedTurn[];
  readonly final: GameState;
}

/** A bot-against-bot game: `a` plays A, `b` plays B, each turn through `analyzeTake`. */
export function playGame(seed: number, starter: Player, a: Difficulty, b: Difficulty): PlayedGame {
  const players = { A: a, B: b };
  let state = newGame({ seed, starter });
  const turns: PlayedTurn[] = [];
  while (state.result === null) {
    const difficulty = players[state.toMove];
    const analysis = analyzeTake(state, { difficulty });
    turns.push({ state, difficulty, analysis });
    state = after(state, analysis.take);
  }
  return { seed, starter, players, turns, final: state };
}

/** A small seeded generator (mulberry32) for picking test positions; never used by the bot. */
export function generator(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
