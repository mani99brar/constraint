import { describe, expect, it } from 'vitest';
import { ALL_CELLS, playerView, prepareMatch, startMatch, validateSetup, type Preset } from '@okiya/rules';
import {
  defaultSetup,
  FIGHTERS,
  PAPER_TEST_01,
  SPEC_V0_2,
  TILES,
  validateFighters,
  validatePreset,
  validateScenario,
  validateTiles,
} from './index';

describe('tiles and fighters', () => {
  it('validates the 16 tiles and the fighter pool', () => {
    expect(TILES).toHaveLength(16);
    expect(validateTiles(TILES)).toEqual([]);
    expect(validateFighters(FIGHTERS)).toEqual([]);
  });

  it('rejects a duplicate tile', () => {
    const tiles = [...TILES.slice(0, 15), TILES[0]!];
    expect(validateTiles(tiles)).toEqual([{ code: 'duplicate-tile', tile: TILES[0] }]);
  });

  it('rejects a duplicate or mislabelled fighter', () => {
    const pusher = FIGHTERS.find((fighter) => fighter.type === 'Pusher')!;
    expect(validateFighters([...FIGHTERS, pusher])).toEqual([{ code: 'duplicate-fighter', value: 'Pusher' }]);
    const mislabelled = FIGHTERS.map((fighter) => (fighter.type === 'Anchor' ? { ...fighter, displacer: true } : fighter));
    expect(validateFighters(mislabelled)).toEqual([{ code: 'displacer-flag', value: 'Anchor', expected: false }]);
  });

  it('gives default setups the rules engine accepts', () => {
    expect(validateSetup(defaultSetup('A'), SPEC_V0_2)).toEqual([]);
    expect(validateSetup(defaultSetup('B'), SPEC_V0_2)).toEqual([]);
  });
});

describe('preset spec-v0.2 (PRD §6, P1)', () => {
  it("holds PRD §6's values with every variant switch at its default", () => {
    expect(SPEC_V0_2).toMatchObject({
      id: 'spec-v0.2',
      rechargesPerPlayer: 3,
      setupTrapsPerPlayer: 2,
      setupTrapsOnDistinctCells: true,
      liveTrapsPerOwnerPerCell: 1,
      openingRule: 'outside-edge-no-constraint',
      trapsTriggerOnOpening: true,
      lockOwnTurnsMissed: 1,
      trapCheckerRule: 'single-adjacent-cell',
      trapCheckerLegalWithNothingFound: true,
      trapperDestinationMustMatch: false,
      trapperKeepsConstraint: true,
      sameTypesAcrossRosters: true,
      repetitionThreshold: 3,
      terminalPrecedence: ['objective', 'blockade', 'repetition'],
      objectivePool: ['Square'],
      variants: {
        anchorProtection: 'through-opponent-next-turn',
        pullerMayTargetAllies: true,
        lockedFightersCountTowardObjective: true,
        displacerLimit: null,
      },
    });
    expect(validatePreset(SPEC_V0_2)).toEqual([]);
  });

  it('rejects impossible presets', () => {
    const withValue = (patch: Partial<Preset>): Preset => ({ ...SPEC_V0_2, ...patch });
    expect(validatePreset(withValue({ rechargesPerPlayer: -1 }))).toEqual([
      { code: 'invalid-preset-value', field: 'rechargesPerPlayer', value: -1 },
    ]);
    expect(validatePreset(withValue({ repetitionThreshold: 1 })).map((issue) => issue.code)).toEqual(['invalid-preset-value']);
    expect(validatePreset(withValue({ variants: { ...SPEC_V0_2.variants, displacerLimit: 5 } }))).toEqual([
      { code: 'invalid-preset-value', field: 'variants.displacerLimit', value: 5 },
    ]);
  });

  it('rejects a Trap Checker that is illegal with nothing found, since legality would reveal hidden traps (spec §9)', () => {
    expect(validatePreset({ ...SPEC_V0_2, trapCheckerLegalWithNothingFound: false })).toEqual([
      { code: 'invalid-preset-value', field: 'trapCheckerLegalWithNothingFound', value: false },
    ]);
  });

  it('rejects any terminal precedence other than the spec §11 order', () => {
    const reordered = ['blockade', 'objective', 'repetition'] as const;
    expect(validatePreset({ ...SPEC_V0_2, terminalPrecedence: reordered })).toEqual([
      { code: 'invalid-preset-value', field: 'terminalPrecedence', value: reordered },
    ]);
    expect(validatePreset({ ...SPEC_V0_2, terminalPrecedence: ['objective', 'blockade'] })).toEqual([
      { code: 'invalid-preset-value', field: 'terminalPrecedence', value: ['objective', 'blockade'] },
    ]);
  });
});

describe('paper test 01 scenario (docs/paper-test-01.md, Fixture)', () => {
  it('validates: 16 distinct tiles, two distinct four-fighter rosters, two traps per side on distinct cells', () => {
    expect(validateScenario(PAPER_TEST_01, SPEC_V0_2)).toEqual([]);
    const board = PAPER_TEST_01.board!;
    expect(new Set(ALL_CELLS.map((cell) => `${board[cell].terrain}-${board[cell].symbol}`)).size).toBe(16);
    for (const player of ['A', 'B'] as const) {
      expect(new Set(PAPER_TEST_01.rosters?.[player]).size).toBe(4);
      expect(new Set(PAPER_TEST_01.traps?.[player]).size).toBe(2);
    }
  });

  it('rejects a scenario with a duplicate tile or a stacked trap', () => {
    const duplicateTile = { ...PAPER_TEST_01, board: { ...PAPER_TEST_01.board!, D4: PAPER_TEST_01.board!.A1 } };
    expect(validateScenario(duplicateTile, SPEC_V0_2).map((issue) => issue.code)).toEqual(['duplicate-tile']);
    const stacked = { ...PAPER_TEST_01, traps: { A: ['B2', 'B2'] as const } };
    expect(validateScenario(stacked, SPEC_V0_2)).toEqual([
      { code: 'scenario-setup', player: 'A', refusal: { code: 'trap-cells-not-distinct', cell: 'B2' } },
    ]);
  });

  it('starts a match with the fixture board, rosters, traps and A as the starting player', () => {
    for (const seed of [1, 2, 3, 4]) {
      const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed, scenario: PAPER_TEST_01 });
      expect(prepared.board).toEqual(PAPER_TEST_01.board);
      const state = startMatch(prepared, { A: defaultSetup('B'), B: defaultSetup('A') });
      expect(state.board).toEqual(PAPER_TEST_01.board);
      expect(state.startingPlayer).toBe('A');
      expect(state.activePlayer).toBe('A');
      expect(state.setups.A).toEqual({ roster: PAPER_TEST_01.rosters?.A, traps: PAPER_TEST_01.traps?.A });
      expect(playerView(state, 'A').ownTraps.map((trap) => trap.cell)).toEqual(['B2', 'C3']);
    }
  });
});
