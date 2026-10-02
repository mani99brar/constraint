import { describe, expect, it } from 'vitest';
import { ALL_CELLS, EDGE_CELLS, legalTakes, newGame, type GameState } from '@okiya/game';
import { matchMasks, positionOf, Solver } from './solver';
import { after, bruteForceTakeValue, bruteForceValue, generator, ReferenceSolver } from './test-support';

// Both exact solvers, the bot's and the test's reference, against a brute force on the engine's `take()` and
// `legalTakes()`, on positions with 8 or fewer empty cells.

const MAX_EMPTY = 8;

/** Every unfinished position with at most `MAX_EMPTY` empty cells of a seeded random game. */
function randomGamePositions(seed: number): GameState[] {
  const next = generator(seed);
  const positions: GameState[] = [];
  let state = newGame({ seed });
  while (state.result === null) {
    if (state.tokens.filter((token) => token === null).length <= MAX_EMPTY) positions.push(state);
    const takes = legalTakes(state);
    state = after(state, takes[Math.floor(next() * takes.length)]!);
  }
  return positions;
}

/** The same tokens with no last tile: the player to take may take any empty edge cell (an opening position). */
function asOpening(state: GameState): GameState {
  return { ...state, lastTile: null };
}

const fromGames = Array.from({ length: 80 }, (_, seed) => randomGamePositions(seed)).flat();
const openings = fromGames
  .filter((state) => state.tokens.filter((token) => token === null).length === MAX_EMPTY)
  .map(asOpening)
  .slice(0, 20);
const POSITIONS = [...fromGames, ...openings];

/** How the game ends after each legal take of `state`, as the engine reports it. */
function endings(state: GameState): string[] {
  return legalTakes(state).flatMap((cell) => {
    const result = after(state, cell).result;
    if (result === null) return [];
    if (result.kind === 'draw') return ['full-board draw'];
    if (result.by === 'blockade') return ['blockade'];
    const next = after(state, cell);
    const blocked = next.tokens.some((token) => token === null) && legalTakes({ ...next, result: null }).length === 0;
    return blocked ? ['shape and blockade at once'] : ['shape'];
  });
}

describe('exact solvers against the engine', () => {
  it('cover the required endings and enough positions', () => {
    expect(POSITIONS.length).toBeGreaterThanOrEqual(200);
    expect(openings.length).toBe(20);
    for (const state of openings) {
      expect(legalTakes(state).length).toBeGreaterThan(0);
      expect(legalTakes(state).every((cell) => EDGE_CELLS.includes(cell))).toBe(true);
    }
    const seen = new Set(POSITIONS.flatMap(endings));
    for (const ending of ['full-board draw', 'blockade', 'shape', 'shape and blockade at once']) expect(seen).toContain(ending);
  });

  it('the bot’s solver and the reference solver give the brute-force value of every position and take', { timeout: 60_000 }, () => {
    for (const state of POSITIONS) {
      const expected = bruteForceValue(state);
      const solver = new Solver(matchMasks(state.board), Number.POSITIVE_INFINITY);
      const reference = new ReferenceSolver(state.board);
      expect(solver.solve(positionOf(state))).toBe(expected);
      expect(reference.value(state)).toBe(expected);
      const bruteTakes = new Map(legalTakes(state).map((cell) => [cell, bruteForceTakeValue(state, cell)]));
      expect(reference.takeValues(state)).toEqual(bruteTakes);
      const botTakes = new Map(solver.solveTakes(positionOf(state)).map(({ cell, value }) => [ALL_CELLS[cell]!, value]));
      expect(botTakes).toEqual(bruteTakes);
    }
  });
});
