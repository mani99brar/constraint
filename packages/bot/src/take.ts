import { ALL_CELLS, type CellId, type GameState } from '@okiya/game';
import {
  BudgetExceeded,
  DRAW,
  FULL_BOARD,
  legalMask,
  LOSS,
  matchMasks,
  OPEN,
  outcomeOf,
  positionOf,
  popcount,
  SHAPE_MASKS,
  Solver,
  TAKER_WINS,
  type Position,
} from './solver';

// The bot of Constraint v1.0 (docs/game-spec.md, PRD §5.4). Easy takes an immediate win and otherwise any legal
// take; Normal searches three takes ahead; Hard plays Normal's search at the opening and from the second take of
// the game on solves every legal take exactly. All three are pure: equal takes are broken by the game's seed and
// the number of takes, never by randomness.

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface TakeOptions {
  /** Defaults to 'normal'. */
  readonly difficulty?: Difficulty;
}

/**
 * The most positions (takes applied) one `chooseTake` call searches, at every difficulty. Measured on the
 * development machine: the exact solver runs about 3.2 million positions per second (warm, Node 24), so this
 * budget is about half a second there (PRD B5). Hard's exact solve at the second take of a game, its largest,
 * needed at most about 150 000 positions over all 12 openings of seeds 0–999, so the budget leaves ten times that.
 */
export const POSITION_BUDGET = 1_500_000;

/** Normal's depth, in takes. */
export const NORMAL_DEPTH = 3;
/**
 * The most positions Normal's search applies: the opening has at most 12 legal takes and every later position
 * at most 6, since a tile matches six others, so 12 + 12·6 + 12·6·6.
 */
export const NORMAL_MAX_POSITIONS = 12 + 12 * 6 + 12 * 6 * 6;

/** What one `chooseTake` call did; counts only, so it is the same on every run. */
export interface TakeAnalysis {
  readonly take: CellId;
  /** Positions searched, one per take applied; never more than the budget. */
  readonly positions: number;
  /** For Hard after the opening: whether the exact solve finished within the budget. Null otherwise. */
  readonly solved: boolean | null;
  /** For a finished exact solve: every legal take's win/draw/loss value (1, 0, -1) from the bot's side. */
  readonly values: ReadonlyMap<CellId, number> | null;
}

/**
 * The bot's take for the player to move: deterministic for a given state and options, and always one of
 * `legalTakes(state)`. Throws when the game has ended or no take is legal.
 */
export function chooseTake(state: GameState, options: TakeOptions = {}): CellId {
  return analyzeTake(state, options).take;
}

/** `chooseTake` with what its search did. `budget` is for tests; it defaults to `POSITION_BUDGET`. */
export function analyzeTake(state: GameState, options: TakeOptions = {}, budget: number = POSITION_BUDGET): TakeAnalysis {
  if (state.result) throw new Error('chooseTake: the game has ended');
  const match = matchMasks(state.board);
  const position = positionOf(state);
  const takes = cellsOf(legalMask(match, position));
  if (takes.length === 0) throw new Error('chooseTake: no legal take');
  const difficulty = options.difficulty ?? 'normal';
  const pick = (cells: readonly number[]) => ALL_CELLS[tieBreak(state, cells)]!;

  if (difficulty === 'easy') {
    const wins = takes.filter((cell) => outcomeOf(match, position.own, position.opp, cell) === TAKER_WINS);
    return { take: pick(wins.length > 0 ? wins : takes), positions: takes.length, solved: null, values: null };
  }
  if (difficulty === 'hard' && position.last >= 0) {
    // The solve leaves room for Normal's search, the fallback should it ever run out of budget.
    const solveBudget = Math.max(0, budget - NORMAL_MAX_POSITIONS);
    const solver = new Solver(match, solveBudget);
    try {
      const values = solver.solveTakes(position);
      return { ...hardChoice(match, position, values, pick), positions: solver.positions, solved: true };
    } catch (error) {
      if (!(error instanceof BudgetExceeded)) throw error;
      const fallback = normalChoice(match, position, budget - solveBudget, pick);
      return { take: fallback.take, positions: solveBudget + fallback.positions, solved: false, values: null };
    }
  }
  const normal = normalChoice(match, position, budget, pick);
  return { take: normal.take, positions: normal.positions, solved: null, values: null };
}

/**
 * Hard's second phase: among the takes of the best exact value, an immediate win if there is one; when every take
 * loses, a take after which the opponent has no immediate win if there is one; then the seeded tie-break.
 */
function hardChoice(
  match: Int32Array,
  position: Position,
  values: readonly { readonly cell: number; readonly value: number }[],
  pick: (cells: readonly number[]) => CellId,
): { readonly take: CellId; readonly values: ReadonlyMap<CellId, number> } {
  const best = Math.max(...values.map(({ value }) => value));
  let candidates = values.filter(({ value }) => value === best).map(({ cell }) => cell);
  const wins = candidates.filter((cell) => outcomeOf(match, position.own, position.opp, cell) === TAKER_WINS);
  if (wins.length > 0) candidates = wins;
  else if (best === LOSS) {
    const safe = candidates.filter((cell) => !opponentWinsAtOnce(match, position, cell));
    if (safe.length > 0) candidates = safe;
  }
  return { take: pick(candidates), values: new Map(values.map(({ cell, value }) => [ALL_CELLS[cell]!, value])) };
}

/** Whether, after the player to take takes `cell` and the game goes on, the opponent has an immediate win. */
function opponentWinsAtOnce(match: Int32Array, { own, opp }: Position, cell: number): boolean {
  if (outcomeOf(match, own, opp, cell) !== OPEN) return false;
  const mine = own | (1 << cell);
  return cellsOf(legalMask(match, { own: opp, opp: mine, last: cell })).some((reply) => outcomeOf(match, opp, mine, reply) === TAKER_WINS);
}

// Normal's scores, from the bot's side: a win is worth more the sooner it comes, and a position the search stops
// in is scored by the shapes each player can still complete.
const WIN_SCORE = 1000;
/** Weights of an open shape (one the other player has no token in) by the tokens already in it. */
const SHAPE_WEIGHTS = [0, 1, 4, 16, 0];

function shapeScore(mine: number, theirs: number): number {
  let score = 0;
  for (const mask of SHAPE_MASKS) {
    if ((theirs & mask) === 0) score += SHAPE_WEIGHTS[popcount(mine & mask)]!;
    if ((mine & mask) === 0) score -= SHAPE_WEIGHTS[popcount(theirs & mask)]!;
  }
  return score;
}

/**
 * Normal's search at another depth, for tests only: it shows what a shallower or deeper search would take. The
 * bot itself always searches `NORMAL_DEPTH` takes.
 */
export function normalTakeAtDepth(state: GameState, depth: number): CellId {
  const match = matchMasks(state.board);
  return normalChoice(match, positionOf(state), POSITION_BUDGET, (cells) => ALL_CELLS[tieBreak(state, cells)]!, depth).take;
}

/** Normal: a full minimax of `NORMAL_DEPTH` takes, every root take scored exactly, then the seeded tie-break. */
function normalChoice(
  match: Int32Array,
  position: Position,
  budget: number,
  pick: (cells: readonly number[]) => CellId,
  depth: number = NORMAL_DEPTH,
): { readonly take: CellId; readonly positions: number } {
  let positions = 0;
  const search = (own: number, opp: number, last: number, depth: number, ply: number): number => {
    // The value of the position for its player to take, who has at least one legal take.
    let best = -Infinity;
    for (const cell of cellsOf(legalMask(match, { own, opp, last }))) {
      positions += 1;
      const outcome = outcomeOf(match, own, opp, cell);
      const mine = own | (1 << cell);
      const value =
        outcome === TAKER_WINS
          ? WIN_SCORE - ply
          : outcome === FULL_BOARD
            ? DRAW
            : depth <= 1
              ? shapeScore(mine, opp)
              : -search(opp, mine, cell, depth - 1, ply + 1);
      if (value > best) best = value;
    }
    return best;
  };
  const takes = cellsOf(legalMask(match, position));
  if (budget < NORMAL_MAX_POSITIONS) return { take: pick(takes), positions: 0 };
  const scores = takes.map((cell) => {
    positions += 1;
    const outcome = outcomeOf(match, position.own, position.opp, cell);
    const mine = position.own | (1 << cell);
    if (outcome === TAKER_WINS) return WIN_SCORE;
    if (outcome === FULL_BOARD) return DRAW;
    return depth <= 1 ? shapeScore(mine, position.opp) : -search(position.opp, mine, cell, depth - 1, 1);
  });
  const best = Math.max(...scores);
  return { take: pick(takes.filter((_, k) => scores[k] === best)), positions };
}

function cellsOf(mask: number): number[] {
  const cells: number[] = [];
  for (let rest = mask; rest !== 0; rest &= rest - 1) cells.push(31 - Math.clz32(rest & -rest));
  return cells;
}

/**
 * The seeded tie-break (PRD B4): a hash of the game's seed and the number of takes so far picks one of the equal
 * takes, given in cell order.
 */
function tieBreak(state: GameState, cells: readonly number[]): number {
  let hash = Math.imul(state.seed ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(state.takes.length + 1, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 15), 0xc2b2ae35);
  hash ^= hash >>> 13;
  return cells[(hash >>> 0) % cells.length]!;
}
