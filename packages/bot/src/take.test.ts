import { describe, expect, it } from 'vitest';
import { ALL_CELLS, cellIndex, legalTakes, newGame, TILES, type CellId, type GameState, type Player } from '@okiya/game';
import { analyzeTake, chooseTake, DIFFICULTIES, NORMAL_MAX_POSITIONS, POSITION_BUDGET } from './index';
import { after, opponentCanWinAtOnce, winsAtOnce } from './test-support';

/**
 * A hand-built position on the unshuffled board, where `TILES` lies in row-major order: row A is Forest, row B
 * Water, row C Mountain, row D Desert, and columns 1–4 are Sun, Moon, Star, Wave. So the tiles matching a cell are
 * exactly the other cells of its row and its column. `seed` only changes the bot's tie-break.
 */
function position(rows: readonly string[], toMove: Player, lastCell: CellId, seed: number): GameState {
  const tokens = rows.join('').split('').map((c) => (c === 'A' || c === 'B' ? c : null));
  return {
    ...newGame({ seed, starter: 'A' }),
    board: TILES,
    tokens,
    toMove,
    lastTile: TILES[cellIndex(lastCell)]!,
    takes: ALL_CELLS.filter((_, i) => tokens[i] !== null),
  };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i);

// A to take after B took D4: the legal takes are D1–D3 and A4–C4, and only the named take wins at once.
const WINS: readonly { readonly by: string; readonly rows: readonly string[]; readonly last: CellId; readonly win: CellId }[] = [
  // A4 completes row A.
  { by: 'a line', rows: ['AAA.', '..B.', '.B..', '...B'], last: 'D4', win: 'A4' },
  // C2 completes the square B1-B2-C1-C2; C3, A4, B4 and D4 are legal too.
  { by: 'a square', rows: ['..B.', 'AA..', 'A..B', 'B...'], last: 'C4', win: 'C2' },
  // A1 leaves B no tile of row A or column 1, the only tiles matching it; D2–D4 are legal too.
  { by: 'a blockade', rows: ['.ABA', 'B...', 'A...', 'B...'], last: 'D1', win: 'A1' },
];

describe('chooseTake on hand-built positions', () => {
  for (const { by, rows, last, win } of WINS) {
    it(`takes an immediate win by ${by} at every difficulty`, () => {
      for (const seed of SEEDS) {
        const state = position(rows, 'A', last, seed);
        const winning = legalTakes(state).filter((cell) => winsAtOnce(state, cell));
        expect(winning).toEqual([win]);
        expect(legalTakes(state).length).toBeGreaterThan(1);
        const result = after(state, win).result;
        expect(result?.kind === 'win' && result.by).toBe(by.split(' ')[1]);
        for (const difficulty of DIFFICULTIES) expect(chooseTake(state, { difficulty })).toBe(win);
      }
    });
  }

  it('Normal and Hard never take a tile that lets the opponent win at once when another take exists', () => {
    // B holds B1–B3 and took D4. A's takes A4 and C4 match B4 (column 4), which completes B's row B.
    const rows = ['A...', 'BBB.', '.AA.', '...B'];
    const losing = new Set<CellId>(['A4', 'C4']);
    for (const seed of SEEDS) {
      const state = position(rows, 'A', 'D4', seed);
      const takes = legalTakes(state);
      expect(takes.filter((cell) => opponentCanWinAtOnce(state, cell))).toEqual([...losing]);
      expect(takes.some((cell) => winsAtOnce(state, cell))).toBe(false);
      for (const difficulty of ['normal', 'hard'] as const) expect(losing.has(chooseTake(state, { difficulty }))).toBe(false);
    }
  });

  it('Easy looks no further than its own take', () => {
    const state = position(['A...', 'BBB.', '.AA.', '...B'], 'A', 'D4', 0);
    const analysis = analyzeTake(state, { difficulty: 'easy' });
    expect(analysis.positions).toBe(legalTakes(state).length);
    expect(legalTakes(state)).toContain(analysis.take);
  });

  it('varies equal takes with the seed', () => {
    const takes = new Set(SEEDS.map((seed) => chooseTake(newGame({ seed, starter: 'A' }), { difficulty: 'easy' })));
    expect(takes.size).toBeGreaterThan(3);
  });

  it('Hard plays Normal’s search at the opening and solves exactly from the second take on', () => {
    for (const seed of SEEDS) {
      const opening = newGame({ seed });
      const hard = analyzeTake(opening, { difficulty: 'hard' });
      expect(hard).toEqual(analyzeTake(opening, { difficulty: 'normal' }));
      expect(hard.solved).toBeNull();
      expect(hard.positions).toBeLessThanOrEqual(NORMAL_MAX_POSITIONS);
      const second = analyzeTake(after(opening, hard.take), { difficulty: 'hard' });
      expect(second.solved).toBe(true);
      expect(second.positions).toBeLessThanOrEqual(POSITION_BUDGET);
    }
  });

  it('Hard falls back to Normal’s search, within the budget, when the budget cannot finish the solve', () => {
    for (const seed of SEEDS) {
      const state = after(newGame({ seed }), chooseTake(newGame({ seed }), { difficulty: 'normal' }));
      for (const budget of [0, 10, NORMAL_MAX_POSITIONS, NORMAL_MAX_POSITIONS + 1000]) {
        const analysis = analyzeTake(state, { difficulty: 'hard' }, budget);
        expect(analysis.solved).toBe(false);
        expect(analysis.positions).toBeLessThanOrEqual(budget);
        expect(legalTakes(state)).toContain(analysis.take);
      }
      const fallback = analyzeTake(state, { difficulty: 'hard' }, NORMAL_MAX_POSITIONS + 1000);
      expect(fallback.take).toBe(chooseTake(state, { difficulty: 'normal' }));
    }
  });

  it('throws when the game has ended', () => {
    const state = position(['AAA.', '..B.', '.B..', '...B'], 'A', 'D4', 0);
    const ended = after(state, 'A4');
    expect(ended.result).not.toBeNull();
    for (const difficulty of DIFFICULTIES) expect(() => chooseTake(ended, { difficulty })).toThrow();
  });
});
