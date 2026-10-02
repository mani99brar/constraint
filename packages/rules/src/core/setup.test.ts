import { describe, expect, it } from 'vitest';
import { ALL_CELLS, isEdgeCell, matchLogOf, prepareMatch, replayMatchLog, startMatch, validateSetup, InvalidSetupError } from '../api';
import { GRID_BOARD, seededMatch, TEST_PRESET, TEST_SETUPS, TEST_TILES } from './testing';

describe('board shuffle (spec §3, §5 step 1)', () => {
  it('is a 4×4 grid holding every terrain/symbol pair exactly once', () => {
    const { board } = prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 7 });
    expect(Object.keys(board)).toEqual([...ALL_CELLS]);
    expect(ALL_CELLS).toHaveLength(16);
    const pairs = ALL_CELLS.map((cell) => `${board[cell].terrain}-${board[cell].symbol}`);
    expect(new Set(pairs).size).toBe(16);
    expect(new Set(pairs)).toEqual(new Set(TEST_TILES.map((tile) => `${tile.terrain}-${tile.symbol}`)));
  });

  it('is decided by the seed', () => {
    const layout = (seed: number) => prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed }).board;
    expect(layout(42)).toEqual(layout(42));
    expect(layout(42)).not.toEqual(layout(43));
    expect(ALL_CELLS.map((cell) => layout(42)[cell])).not.toEqual(TEST_TILES);
  });

  it('picks the starting player with the seed', () => {
    const starters = new Set(Array.from({ length: 20 }, (_, seed) => seededMatch(seed).startingPlayer));
    expect(starters).toEqual(new Set(['A', 'B']));
    expect(seededMatch(5).startingPlayer).toBe(seededMatch(5).startingPlayer);
  });
});

describe('setup validator (spec §4, §5; PRD S2)', () => {
  it('accepts the default setups', () => {
    expect(validateSetup(TEST_SETUPS.A, TEST_PRESET)).toEqual([]);
    expect(validateSetup(TEST_SETUPS.B, TEST_PRESET)).toEqual([]);
  });

  it('refuses two identical fighters in a roster', () => {
    const refusals = validateSetup({ roster: ['Pusher', 'Pusher', 'Anchor', 'Trapper'], traps: ['A1', 'A2'] }, TEST_PRESET);
    expect(refusals).toEqual([{ code: 'fighters-not-distinct', fighter: 'Pusher' }]);
  });

  it('refuses two traps on one cell', () => {
    const refusals = validateSetup({ roster: TEST_SETUPS.A.roster, traps: ['C3', 'C3'] }, TEST_PRESET);
    expect(refusals).toEqual([{ code: 'trap-cells-not-distinct', cell: 'C3' }]);
  });

  it("refuses a roster above the preset's displacer limit", () => {
    const preset = { ...TEST_PRESET, variants: { ...TEST_PRESET.variants, displacerLimit: 1 } };
    const refusals = validateSetup({ roster: ['Pusher', 'Puller', 'Anchor', 'Trapper'], traps: ['A1', 'A2'] }, preset);
    expect(refusals).toEqual([{ code: 'displacer-limit', limit: 1, actual: 2 }]);
  });

  it('refuses the wrong roster size and trap count', () => {
    const refusals = validateSetup({ roster: ['Pusher'], traps: ['A1'] }, TEST_PRESET);
    expect(refusals.map((refusal) => refusal.code)).toEqual(['roster-size', 'trap-count']);
  });

  it('makes startMatch throw with the structured refusals', () => {
    const prepared = prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 1 });
    const bad = { ...TEST_SETUPS, B: { roster: TEST_SETUPS.B.roster, traps: ['D1', 'D1'] as const } };
    expect(() => startMatch(prepared, bad)).toThrow(InvalidSetupError);
  });
});

describe('match start', () => {
  it('starts with every fighter in reserve, charged, no constraint and the opening deployment on an edge', () => {
    const state = seededMatch(3);
    expect(state.fighters.every((fighter) => fighter.cell === null && fighter.charge === 1)).toBe(true);
    expect(state.constraint).toBeNull();
    expect(state.turn).toBe(1);
    expect(state.traps).toHaveLength(4);
    expect(state.trapHistory.every((record) => record.fate.kind === 'live' && record.source === 'setup')).toBe(true);
    expect(state.recharges).toEqual({ A: 3, B: 3 });
    expect(state.repetition).toHaveLength(1);
  });

  it('applies a scenario override of the starting player, rosters and traps', () => {
    const prepared = prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 1 });
    const state = startMatch(prepared, TEST_SETUPS, {
      id: 's',
      name: 'S',
      startingPlayer: 'B',
      rosters: { B: ['Anchor', 'Pusher', 'Puller', 'Trapper'] },
      traps: { A: ['A1', 'D4'] },
    });
    expect(state.activePlayer).toBe('B');
    expect(state.setups.B.roster).toEqual(['Anchor', 'Pusher', 'Puller', 'Trapper']);
    expect(state.traps.filter((trap) => trap.owner === 'A').map((trap) => trap.cell)).toEqual(['A1', 'D4']);
    expect(isEdgeCell('A1')).toBe(true);
  });

  it('merges the scenarios of both setup calls, so the board override survives and the log replays to it', () => {
    const prepared = prepareMatch({
      tiles: TEST_TILES,
      preset: TEST_PRESET,
      seed: 8,
      scenario: { id: 'board', name: 'Board', board: GRID_BOARD, startingPlayer: 'B', traps: { A: ['A1', 'A2'] } },
    });
    const state = startMatch(prepared, TEST_SETUPS, {
      id: 'late',
      name: 'Late',
      rosters: { B: ['Anchor', 'Pusher', 'Puller', 'Trapper'] },
      traps: { B: ['D1', 'D4'] },
    });
    expect(state.board).toEqual(GRID_BOARD);
    expect(state.scenario).toEqual({
      id: 'late',
      name: 'Late',
      board: GRID_BOARD,
      rosters: { B: ['Anchor', 'Pusher', 'Puller', 'Trapper'] },
      traps: { A: ['A1', 'A2'], B: ['D1', 'D4'] },
      startingPlayer: 'B',
    });
    expect(state.activePlayer).toBe('B');
    expect(state.traps.map((trap) => `${trap.owner}@${trap.cell}`)).toEqual(['A@A1', 'A@A2', 'B@D1', 'B@D4']);
    expect(replayMatchLog(JSON.parse(JSON.stringify(matchLogOf(state))), TEST_TILES)).toEqual(state);
  });

  it('records only the board prepareMatch used, never a later board it could not apply', () => {
    const prepared = prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 8 });
    const state = startMatch(prepared, TEST_SETUPS, { id: 'late', name: 'Late', board: GRID_BOARD, startingPlayer: 'A' });
    expect(state.board).toEqual(prepared.board);
    expect(state.scenario).toEqual({ id: 'late', name: 'Late', startingPlayer: 'A' });
    expect(replayMatchLog(matchLogOf(state), TEST_TILES).board).toEqual(prepared.board);
  });

  it('keeps the random draws of the board and starting player of the skeleton for a seed', () => {
    // Values the skeleton engine gave; browser tests rely on a seed keeping its board and starter.
    expect(prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 2024 }).board.A1).toEqual({ terrain: 'Forest', symbol: 'Moon' });
    expect([0, 1, 2, 3, 4, 5].map((seed) => seededMatch(seed).startingPlayer).join('')).toBe('AABBBB');
  });
});
