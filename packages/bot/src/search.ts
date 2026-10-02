import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import { applyAction, hypotheticalState, listLegalActions, type Action, type CellId, type MatchState, type PlayerId, type PlayerView } from '@okiya/rules';
import { evaluate, terminalScore, WIN_SCORE } from './evaluate';

/** Search limits of `chooseAction`; both are counts, never clock time, so the bot stays pure. */
export interface SearchOptions {
  /** Plies searched at most: 1 looks at the bot's own actions, 2 adds the human's best reply. */
  readonly maxDepth?: number;
  /** Positions evaluated at most, one per action applied, over all depths. */
  readonly budget?: number;
}

export const DEFAULT_MAX_DEPTH = 2;
export const DEFAULT_BUDGET = 3000;

/** Root tie-break against entering a cell nobody has entered since setup with a charge (trap risk). */
const UNSCOUTED_ENTRY = 0.1;
const TURN_SALT = 0x9e3779b1;

/** The bot's generator for one turn, seeded by the match seed and the turn number only. */
function turnGenerator(seed: number, turn: number): RandomGenerator {
  return xoroshiro128plus((seed ^ Math.imul(turn, TURN_SALT)) | 0);
}

/** A seeded Fisher–Yates shuffle; it orders equal choices so ties do not favour list order. */
function shuffled<T>(generator: RandomGenerator, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = uniformInt(generator, 0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

class BudgetExhausted extends Error {}

interface Root {
  readonly action: Action;
  /** The hypothetical state after the action, or null if the hypothetical state refuses it. */
  readonly state: MatchState | null;
  readonly penalty: number;
  score: number;
}

/** Cells some fighter has entered since setup, from the public log, and the bot's own inspected cells. */
function scoutedCells(view: PlayerView): Set<CellId> {
  const cells = new Set<CellId>();
  for (const entry of view.log) {
    for (const event of entry.events) if (event.kind === 'fighter-entered') cells.add(event.to);
  }
  for (const inspection of view.inspections) cells.add(inspection.cell);
  return cells;
}

/** Whether an ability action relocates one of the bot's fighters into a cell nobody has entered. */
function entersUnscouted(before: MatchState, after: MatchState, me: PlayerId, scouted: Set<CellId>): boolean {
  return after.fighters.some((fighter) => {
    if (fighter.owner !== me || !fighter.cell || scouted.has(fighter.cell)) return false;
    return before.fighters.find((old) => old.id === fighter.id)?.cell !== fighter.cell;
  });
}

class Search {
  private left: number;

  constructor(
    private readonly me: PlayerId,
    budget: number,
  ) {
    this.left = budget;
  }

  /** Applies one action, counting it as an evaluated position. */
  apply(state: MatchState, action: Action): MatchState | null {
    if (this.left <= 0) throw new BudgetExhausted();
    this.left -= 1;
    const applied = applyAction(state, action);
    return applied.ok ? applied.state : null;
  }

  /** Minimax with alpha-beta pruning; scores are always from the bot's side. */
  value(state: MatchState, depth: number, alpha: number, beta: number, ply: number): number {
    if (state.result) return terminalScore(state.result, this.me, ply);
    if (depth === 0) return evaluate(state, this.me);
    const maximizing = state.activePlayer === this.me;
    let best = maximizing ? -Infinity : Infinity;
    for (const action of listLegalActions(state)) {
      const next = this.apply(state, action);
      if (!next) continue;
      const score = this.value(next, depth - 1, alpha, beta, ply + 1);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, score);
      }
      if (alpha >= beta) break;
    }
    return best === -Infinity || best === Infinity ? evaluate(state, this.me) : best;
  }
}

/**
 * Chooses one action from the legal-action list using only the bot's player view (PRD B1, B2).
 * It looks ahead on `hypotheticalState(view)` through the public rules API: depth by depth up to
 * `maxDepth` plies, until the position budget runs out, and returns the best action of the
 * deepest completed level. Before any level completes it falls back to a seeded pick. Equal
 * choices are ordered by the generator for the view's seed and turn, so a replay reproduces the
 * choice exactly (PRD B3).
 */
export function chooseAction(view: PlayerView, legalActions: readonly Action[], options: SearchOptions = {}): Action {
  if (legalActions.length === 0) throw new Error('The bot has no legal action to choose from');
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const budget = options.budget ?? DEFAULT_BUDGET;
  const order = shuffled(turnGenerator(view.seed, view.turn), legalActions);
  let best = order[0]!;
  if (legalActions.length === 1 || view.result || view.activePlayer !== view.viewer) return best;

  const me = view.viewer;
  const hypothetical = hypotheticalState(view);
  const scouted = scoutedCells(view);
  const search = new Search(me, budget);
  const roots: Root[] = [];
  try {
    for (const action of order) {
      const state = search.apply(hypothetical, action);
      const penalty = state && action.kind === 'ability' && entersUnscouted(hypothetical, state, me, scouted) ? UNSCOUTED_ENTRY : 0;
      roots.push({ action, state, penalty, score: -Infinity });
    }
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      let alpha = -Infinity;
      const scores = new Map<Root, number>();
      for (const root of roots) {
        // A refused root keeps the lowest score; ordering by the last level's scores lets
        // alpha-beta cut more and breaks equal scores toward the better shallower result.
        const score = root.state ? search.value(root.state, depth - 1, alpha, Infinity, 1) - root.penalty : -Infinity;
        scores.set(root, score);
        alpha = Math.max(alpha, score);
      }
      for (const root of roots) root.score = scores.get(root)!;
      roots.sort((a, b) => b.score - a.score);
      best = roots[0]!.action;
      if (Math.abs(roots[0]!.score) >= WIN_SCORE - maxDepth - 1) break;
    }
  } catch (error) {
    if (!(error instanceof BudgetExhausted)) throw error;
  }
  return best;
}
