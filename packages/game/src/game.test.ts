import { describe, expect, it } from 'vitest';
import {
  ALL_CELLS,
  EDGE_CELLS,
  LINES,
  SQUARES,
  TILES,
  cellIndex,
  gameLogOf,
  legalTakes,
  newGame,
  parseGameLog,
  replayGame,
  take,
  tilesMatch,
  validateTake,
  type CellId,
  type GameState,
  type Player,
} from './index';

/**
 * A hand-built position on the unshuffled board, where `TILES` lies in row-major order: row A is Forest, row B
 * Water, row C Mountain, row D Desert, and columns 1–4 are Sun, Moon, Star, Wave. So the tiles matching a cell are
 * exactly the other cells of its row and its column.
 */
function position(rows: readonly string[], toMove: Player, lastCell: CellId): GameState {
  const tokens = rows.join('').split('').map((c) => (c === 'A' || c === 'B' ? c : null));
  return {
    ...newGame({ seed: 1, starter: 'A' }),
    board: TILES,
    tokens,
    toMove,
    lastTile: TILES[cellIndex(lastCell)]!,
    takes: ALL_CELLS.filter((_, i) => tokens[i] !== null),
  };
}

function played(seed: number, count: number): GameState {
  let state = newGame({ seed });
  for (let i = 0; i < count && !state.result; i += 1) {
    const options = legalTakes(state);
    const next = take(state, options[(seed + i * 7) % options.length]!);
    if (!next.ok) throw new Error('a legal take was refused');
    state = next.state;
  }
  return state;
}

describe('components (spec §1)', () => {
  it('has 16 distinct tiles, each matching exactly six others', () => {
    expect(new Set(TILES.map((t) => `${t.terrain}-${t.symbol}`)).size).toBe(16);
    for (const tile of TILES) expect(TILES.filter((other) => other !== tile && tilesMatch(tile, other))).toHaveLength(6);
  });

  it('has 12 edge cells, ten lines and nine squares', () => {
    expect(EDGE_CELLS).toHaveLength(12);
    expect(EDGE_CELLS).not.toContain('B2');
    expect(LINES).toHaveLength(10);
    expect(LINES).toContainEqual(['A1', 'B2', 'C3', 'D4']);
    expect(LINES).toContainEqual(['A4', 'B3', 'C2', 'D1']);
    expect(SQUARES).toHaveLength(9);
    expect(SQUARES).toContainEqual(['C3', 'C4', 'D3', 'D4']);
  });
});

describe('setup (spec §2, §5, §6)', () => {
  it('lays all 16 tiles from the seed, the same seed giving the same board', () => {
    const game = newGame({ seed: 42 });
    expect(new Set(game.board.map((t) => `${t.terrain}-${t.symbol}`)).size).toBe(16);
    expect(newGame({ seed: 42 })).toEqual(game);
    expect(newGame({ seed: 43 }).board).not.toEqual(game.board);
    expect(game.tokens.every((t) => t === null)).toBe(true);
    expect(game.lastTile).toBeNull();
    expect(game.toMove).toBe(game.starter);
  });

  it('uses a given starting player, and otherwise lets the seed choose both players over many seeds', () => {
    expect(newGame({ seed: 5, starter: 'B' }).toMove).toBe('B');
    const starters = new Set(Array.from({ length: 20 }, (_, seed) => newGame({ seed }).starter));
    expect(starters).toEqual(new Set(['A', 'B']));
  });

  it('refuses a seed that is not a 32-bit unsigned integer', () => {
    for (const seed of [-1, 1.5, 2 ** 32, Number.NaN]) expect(() => newGame({ seed })).toThrow();
  });
});

describe('taking a tile (spec §3)', () => {
  it('opens on any edge tile and never an inner one', () => {
    const game = newGame({ seed: 3 });
    expect(legalTakes(game)).toEqual(EDGE_CELLS);
    expect(validateTake(game, 'B2')).toEqual({ code: 'not-edge', cell: 'B2' });
  });

  it('places a token, makes the taken tile the last tile and hands the turn over', () => {
    const game = newGame({ seed: 3, starter: 'A' });
    const result = take(game, 'A1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.tokens[0]).toBe('A');
    expect(result.state.lastTile).toEqual(game.board[0]);
    expect(result.state.toMove).toBe('B');
    expect(result.state.takes).toEqual(['A1']);
  });

  it('then allows exactly the tiles matching the last tile, anywhere on the board', () => {
    const state = position(['....', '.A..', '....', '....'], 'B', 'B2');
    expect(legalTakes(state)).toEqual(['A2', 'B1', 'B3', 'B4', 'C2', 'D2']);
    expect(validateTake(state, 'D4')).toEqual({ code: 'no-match', cell: 'D4', tile: TILES[15], lastTile: TILES[5] });
  });

  it('refuses a cell holding a token, an unknown cell and any take after the end', () => {
    const state = position(['A...', '....', '....', '....'], 'B', 'A1');
    expect(validateTake(state, 'A1')).toEqual({ code: 'cell-taken', cell: 'A1' });
    expect(validateTake(state, 'E5')).toEqual({ code: 'unknown-cell', cell: 'E5' });
    const ended: GameState = { ...state, result: { kind: 'draw', by: 'full-board' } };
    expect(take(ended, 'A2')).toEqual({ ok: false, refusal: { code: 'game-over' } });
    expect(legalTakes(ended)).toEqual([]);
  });
});

describe('end of the game (spec §4)', () => {
  it('wins with a full row, a full column or a long diagonal', () => {
    const row = take(position(['AAA.', 'BB..', 'B...', '....'], 'A', 'D4'), 'A4');
    expect(row.ok && row.state.result).toEqual({ kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'A2', 'A3', 'A4'] });
    const column = take(position(['B...', 'B.A.', 'B.A.', '.A..'], 'B', 'D2'), 'D1');
    expect(column.ok && column.state.result).toEqual({ kind: 'win', winner: 'B', by: 'line', cells: ['A1', 'B1', 'C1', 'D1'] });
    const diagonal = take(position(['...A', '..A.', '.A..', '.BBB'], 'A', 'D2'), 'D1');
    expect(diagonal.ok && diagonal.state.result).toEqual({ kind: 'win', winner: 'A', by: 'line', cells: ['A4', 'B3', 'C2', 'D1'] });
  });

  it('wins with a 2×2 square', () => {
    const result = take(position(['....', '.AA.', '.A..', 'BBB.'], 'A', 'C4'), 'C3');
    expect(result.ok && result.state.result).toEqual({ kind: 'win', winner: 'A', by: 'square', cells: ['B2', 'B3', 'C2', 'C3'] });
  });

  it('draws when the board fills with no shape', () => {
    const result = take(position(['AABB', 'BBAA', 'AABB', 'BBA.'], 'A', 'D3'), 'D4');
    expect(result.ok && result.state.result).toEqual({ kind: 'draw', by: 'full-board' });
  });

  it('checks a shape before the full board', () => {
    const result = take(position(['AABB', 'BBBA', 'BAAA', 'BBA.'], 'A', 'D3'), 'D4');
    expect(result.ok && result.state.result).toEqual({ kind: 'win', winner: 'A', by: 'square', cells: ['C3', 'C4', 'D3', 'D4'] });
  });

  it('wins by blockade when no tile left matches the last tile', () => {
    const result = take(position(['.BAB', 'A...', 'B...', 'A...'], 'A', 'B1'), 'A1');
    expect(result.ok && result.state.result).toEqual({ kind: 'win', winner: 'A', by: 'blockade' });
  });

  it('checks a shape before a blockade', () => {
    const result = take(position(['.BBB', 'A...', 'A...', 'A...'], 'A', 'B1'), 'A1');
    expect(result.ok && result.state.result).toEqual({ kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'B1', 'C1', 'D1'] });
  });

  it('ends every game within 16 takes, with a result', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const state = played(seed, 16);
      expect(state.result, `seed ${seed}`).not.toBeNull();
      expect(state.takes.length).toBeLessThanOrEqual(16);
    }
  });
});

describe('game log (spec §6)', () => {
  it('replays a game exactly from its seed, starter and takes', () => {
    for (const seed of [0, 9, 77]) {
      const final = played(seed, 16);
      const replayed = replayGame(gameLogOf(final));
      expect(replayed.ok && replayed.states.at(-1)).toEqual(final);
      expect(replayed.ok && replayed.states).toHaveLength(final.takes.length + 1);
    }
  });

  it('parses a log after a JSON round trip and names a malformed field', () => {
    const log = gameLogOf(played(4, 6));
    expect(parseGameLog(JSON.parse(JSON.stringify(log)))).toEqual({ ok: true, log });
    expect(parseGameLog(null)).toEqual({ ok: false, refusal: { code: 'not-a-game-log', field: '' } });
    expect(parseGameLog({ ...log, formatVersion: 2 })).toEqual({ ok: false, refusal: { code: 'unsupported-format-version', found: 2 } });
    expect(parseGameLog({ ...log, seed: -3 })).toEqual({ ok: false, refusal: { code: 'not-a-game-log', field: 'seed' } });
    expect(parseGameLog({ ...log, starter: 'C' })).toEqual({ ok: false, refusal: { code: 'not-a-game-log', field: 'starter' } });
    expect(parseGameLog({ ...log, takes: ['A1', 'Z9'] })).toEqual({ ok: false, refusal: { code: 'not-a-game-log', field: 'takes.1' } });
  });

  it('refuses an illegal take with its index', () => {
    const log = gameLogOf(played(4, 3));
    const repeated = { ...log, takes: [log.takes[0]!, log.takes[0]!] };
    expect(replayGame(repeated)).toEqual({ ok: false, refusal: { code: 'take-refused', takeIndex: 1, refusal: { code: 'cell-taken', cell: log.takes[0] } } });
  });
});
