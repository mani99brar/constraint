import type { Board, Scenario, Tile } from '@okiya/rules';

const T = (terrain: Tile['terrain'], symbol: Tile['symbol']): Tile => ({ terrain, symbol });

/** The board of the paper test 01 fixture (`docs/paper-test-01.md`, Fixture). */
const PAPER_TEST_01_BOARD: Board = {
  A1: T('Forest', 'Sun'), A2: T('Water', 'Moon'), A3: T('Mountain', 'Star'), A4: T('Desert', 'Wave'),
  B1: T('Mountain', 'Wave'), B2: T('Desert', 'Sun'), B3: T('Forest', 'Moon'), B4: T('Water', 'Star'),
  C1: T('Water', 'Sun'), C2: T('Forest', 'Star'), C3: T('Desert', 'Moon'), C4: T('Mountain', 'Moon'),
  D1: T('Desert', 'Star'), D2: T('Water', 'Wave'), D3: T('Mountain', 'Sun'), D4: T('Forest', 'Wave'),
};

/** Paper test 01: fixture board, rosters, setup traps and A starting (PRD S4). */
export const PAPER_TEST_01: Scenario = {
  id: 'paper-test-01',
  name: 'Paper test 01 fixture',
  board: PAPER_TEST_01_BOARD,
  rosters: {
    A: ['Teleporter', 'Pusher', 'TrapChecker', 'TerrainWeaver'],
    B: ['Swapper', 'Upgrader', 'Puller', 'Trapper'],
  },
  traps: { A: ['B2', 'C3'], B: ['A3', 'D2'] },
  startingPlayer: 'A',
};

/**
 * The report's next test (`docs/paper-test-01.md`, Next test): the same fixture with B starting
 * and the rosters swapped. Each side's setup traps move with its roster.
 */
export const PAPER_TEST_01_SWAPPED: Scenario = {
  id: 'paper-test-01-swapped',
  name: 'Paper test 01, B starts, rosters swapped',
  board: PAPER_TEST_01_BOARD,
  rosters: { A: PAPER_TEST_01.rosters!.B!, B: PAPER_TEST_01.rosters!.A! },
  traps: { A: PAPER_TEST_01.traps!.B!, B: PAPER_TEST_01.traps!.A! },
  startingPlayer: 'B',
};

export const SCENARIOS: readonly Scenario[] = [PAPER_TEST_01, PAPER_TEST_01_SWAPPED];
