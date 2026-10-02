import { ALL_CELLS, cellIndex, EDGE_CELLS, LINES, SQUARES, tilesMatch, type GameState, type Tile } from '@okiya/game';

// The bot's view of a Constraint v1.0 position (docs/game-spec.md) as bitmasks: bit i is cell `ALL_CELLS[i]`.
// `own` holds the tokens of the player to take, `opp` the other player's, and `last` the cell of the last tile,
// or -1 at the opening. Every value here is from the side of the player to take.

export const FULL = 0xffff;
export const EDGE_MASK = EDGE_CELLS.reduce((mask, cell) => mask | (1 << cellIndex(cell)), 0);
/** The ten lines and nine squares (spec §4). */
export const SHAPE_MASKS = [...LINES, ...SQUARES].map((cells) => cells.reduce((mask, cell) => mask | (1 << cellIndex(cell)), 0));
/** The line and square masks through each cell. */
const SHAPES_AT: readonly (readonly number[])[] = ALL_CELLS.map((_, i) => SHAPE_MASKS.filter((mask) => (mask & (1 << i)) !== 0));

export const WIN = 1;
export const DRAW = 0;
export const LOSS = -1;

export interface Position {
  readonly own: number;
  readonly opp: number;
  readonly last: number;
}

/** For each cell, the cells whose tiles match its tile, itself excluded. */
export function matchMasks(board: readonly Tile[]): Int32Array {
  const masks = new Int32Array(16);
  for (let i = 0; i < 16; i += 1) {
    for (let j = 0; j < 16; j += 1) if (i !== j && tilesMatch(board[i]!, board[j]!)) masks[i]! |= 1 << j;
  }
  return masks;
}

export function positionOf(state: GameState): Position {
  let own = 0;
  let opp = 0;
  state.tokens.forEach((token, i) => {
    if (token === state.toMove) own |= 1 << i;
    else if (token !== null) opp |= 1 << i;
  });
  const lastTile = state.lastTile;
  const last = lastTile === null ? -1 : state.board.findIndex((tile) => tile.terrain === lastTile.terrain && tile.symbol === lastTile.symbol);
  return { own, opp, last };
}

export function legalMask(match: Int32Array, { own, opp, last }: Position): number {
  const empty = ~(own | opp) & FULL;
  return last < 0 ? empty & EDGE_MASK : empty & match[last]!;
}

/** Whether `tokens`, which hold `cell`, complete a line or a square through it. */
export function completesShape(tokens: number, cell: number): boolean {
  const shapes = SHAPES_AT[cell]!;
  for (let k = 0; k < shapes.length; k += 1) {
    const mask = shapes[k]!;
    if ((tokens & mask) === mask) return true;
  }
  return false;
}

/** What a take leads to: the game goes on, the taker wins by a shape or a blockade, or a full board draws. */
export const OPEN = 0;
export const TAKER_WINS = 1;
export const FULL_BOARD = 2;

/** The end checks of spec §4, in order, after the player to take takes `cell`. */
export function outcomeOf(match: Int32Array, own: number, opp: number, cell: number): number {
  const mine = own | (1 << cell);
  if (completesShape(mine, cell)) return TAKER_WINS;
  const empty = ~(mine | opp) & FULL;
  if (empty === 0) return FULL_BOARD;
  return (empty & match[cell]!) === 0 ? TAKER_WINS : OPEN;
}

/** A value for the other player: a win is a loss, a draw stays a draw (0, not -0). */
export function negate(value: number): number {
  return value === DRAW ? DRAW : -value;
}

export function popcount(mask: number): number {
  let n = mask - ((mask >>> 1) & 0x5555);
  n = (n & 0x3333) + ((n >>> 2) & 0x3333);
  n = (n + (n >>> 4)) & 0x0f0f;
  return (n + (n >>> 8)) & 0x1f;
}

/** Thrown inside a search when it would pass its position budget. */
export class BudgetExceeded extends Error {
  constructor() {
    super('position budget exceeded');
  }
}

// Transposition-table entries hold a value and whether it is exact or a bound of an alpha-beta window.
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

/**
 * The exact win/draw/loss solver: alpha-beta negamax over values -1, 0 and 1 with a transposition table. A win
 * is the best value, so finding one cuts the remaining takes. `positions` counts every take applied, terminal or
 * not; passing `budget` throws `BudgetExceeded`.
 */
export class Solver {
  positions = 0;
  private readonly table = new Map<number, number>();

  constructor(
    private readonly match: Int32Array,
    private readonly budget: number,
  ) {}

  /** The value of a position whose player to take has at least one legal take. */
  solve(position: Position): number {
    return this.search(position.own, position.opp, position.last, LOSS, WIN);
  }

  /** The exact value of every legal take, in cell order; a take's value is from the taker's side. */
  solveTakes(position: Position): { readonly cell: number; readonly value: number }[] {
    const { own, opp } = position;
    const values: { cell: number; value: number }[] = [];
    for (let moves = legalMask(this.match, position); moves !== 0; moves &= moves - 1) {
      const cell = 31 - Math.clz32(moves & -moves);
      this.count();
      const outcome = outcomeOf(this.match, own, opp, cell);
      const value = outcome === TAKER_WINS ? WIN : outcome === FULL_BOARD ? DRAW : negate(this.search(opp, own | (1 << cell), cell, LOSS, WIN));
      values.push({ cell, value });
    }
    return values;
  }

  private count(): void {
    this.positions += 1;
    if (this.positions > this.budget) throw new BudgetExceeded();
  }

  private search(own: number, opp: number, last: number, alpha: number, beta: number): number {
    const key = last < 0 ? -1 : ((own * 65536 + opp) * 16 + last);
    if (key >= 0) {
      const entry = this.table.get(key);
      if (entry !== undefined) {
        const value = (entry >> 2) - 1;
        const flag = entry & 3;
        if (flag === EXACT) return value;
        if (flag === LOWER && value >= beta) return value;
        if (flag === UPPER && value <= alpha) return value;
      }
    }
    const match = this.match;
    const empty = ~(own | opp) & FULL;
    const moves = last < 0 ? empty & EDGE_MASK : empty & match[last]!;
    // First pass: an immediate win ends the search; a full-board draw is a value; the rest are searched below,
    // fewest replies for the opponent first.
    let best = LOSS;
    let children = 0;
    const cells: number[] = [];
    const replies: number[] = [];
    for (let rest = moves; rest !== 0; rest &= rest - 1) {
      const bit = rest & -rest;
      const cell = 31 - Math.clz32(bit);
      this.count();
      const mine = own | bit;
      if (completesShape(mine, cell)) return this.store(key, WIN, EXACT);
      const left = empty & ~bit;
      if (left === 0) {
        best = DRAW;
        continue;
      }
      const reply = popcount(left & match[cell]!);
      if (reply === 0) return this.store(key, WIN, EXACT);
      let k = children;
      while (k > 0 && replies[k - 1]! > reply) {
        cells[k] = cells[k - 1]!;
        replies[k] = replies[k - 1]!;
        k -= 1;
      }
      cells[k] = cell;
      replies[k] = reply;
      children += 1;
    }
    const alphaStart = alpha;
    if (best > alpha) alpha = best;
    for (let k = 0; k < children && alpha < beta; k += 1) {
      const cell = cells[k]!;
      const value = negate(this.search(opp, own | (1 << cell), cell, -beta, -alpha));
      if (value > best) {
        best = value;
        if (value > alpha) alpha = value;
      }
    }
    const flag = best <= alphaStart ? UPPER : best >= beta ? LOWER : EXACT;
    return this.store(key, best, flag);
  }

  private store(key: number, value: number, flag: number): number {
    if (key >= 0) this.table.set(key, ((value + 1) << 2) | flag);
    return value;
  }
}
