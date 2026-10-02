import { describe, expect, it } from 'vitest';
import {
  ALL_CELLS,
  applyAction,
  listLegalActions,
  playerView,
  type CellId,
  type FighterId,
  type MatchState,
  type ResolutionEvent,
  type Tile,
} from '@okiya/rules';
import paperTest01 from '../../../docs/paper-test-01.md?raw';
import { FIGHTERS, PAPER_TEST_01, SPEC_V0_2 } from './index';
import { LEDGER, parseTile, replayTo, startPaperTest01 } from './paper-test-01.fixtures';

// The paper test 01 match (`docs/paper-test-01.md`, Fixture and Phase A ledger) replayed through
// the public API under preset spec-v0.2.

/** The fixture table under `## Fixture`, read cell by cell. */
function fixtureTable(doc: string): Record<CellId, Tile> {
  const section = doc.slice(doc.indexOf('## Fixture'));
  const block = section.slice(section.indexOf('```') + 3, section.indexOf('```', section.indexOf('```') + 3));
  const rows = block.split('\n').filter((line) => /^[A-D]\s/.test(line));
  expect(rows).toHaveLength(4);
  const cells: Partial<Record<CellId, Tile>> = {};
  for (const row of rows) {
    const [letter, ...tiles] = row.trim().split(/\s+/);
    expect(tiles).toHaveLength(4);
    tiles.forEach((text, column) => (cells[`${letter}${column + 1}` as CellId] = parseTile(text)));
  }
  return cells as Record<CellId, Tile>;
}

const abbreviation = (text: string) => FIGHTERS.find((fighter) => fighter.abbreviation === text)!.type;

/** One fixture line such as `A: Square. TP, PU, TC, TW. Traps B2, C3. Budget 3.` */
function fixtureSide(doc: string, player: 'A' | 'B') {
  const line = doc.split('\n').find((text) => text.startsWith(`${player}: Square.`))!;
  const [, roster, traps, budget] = /^.: Square\. (.+)\. Traps (.+)\. Budget (\d)\.$/.exec(line)!;
  return { roster: roster!.split(', ').map(abbreviation), traps: traps!.split(', '), budget: Number(budget) };
}

/** The report's legal-action counts T1–T28, from the Phase A evidence table. */
function reportedCounts(doc: string): number[] {
  const line = doc.split('\n').find((text) => text.startsWith('| Legal-action counts T1–T28 |'))!;
  return line.split('|')[2]!.split(',').map((value) => Number(value.trim()));
}

/**
 * The legal-action count before each action as the engine counts it, one entry per concrete
 * choice (the report's convention). Where the spec shows the report wrong, the entry would carry
 * the spec section and the turn; the engine agreed with all 28 hand-kept counts, so none does.
 */
const EXPECTED_COUNTS: readonly number[] = [48, 24, 20, 14, 16, 10, 16, 10, 6, 4, 4, 3, 8, 3, 6, 5, 2, 4, 6, 5, 8, 6, 8, 4, 6, 5, 9, 5];

interface Step {
  readonly turn: number;
  readonly legalCount: number;
  readonly events: readonly ResolutionEvent[];
}

function replay(): { state: MatchState; steps: Step[] } {
  let state = startPaperTest01();
  const steps: Step[] = [];
  for (const action of LEDGER) {
    const legal = listLegalActions(state);
    expect(legal).toContainEqual(action);
    const applied = applyAction(state, action);
    if (!applied.ok) throw new Error(`T${state.turn} refused: ${JSON.stringify(applied.refusal)}`);
    steps.push({ turn: state.turn, legalCount: legal.length, events: applied.events });
    state = applied.state;
  }
  return { state, steps };
}

describe('paper test 01 fixture (docs/paper-test-01.md, Fixture)', () => {
  it('pins the scenario board cell by cell to the fixture table', () => {
    const table = fixtureTable(paperTest01);
    for (const cell of ALL_CELLS) expect(PAPER_TEST_01.board?.[cell], cell).toEqual(table[cell]);
  });

  it('pins the rosters, setup traps, budget and starter to the fixture lines', () => {
    for (const player of ['A', 'B'] as const) {
      const side = fixtureSide(paperTest01, player);
      expect(PAPER_TEST_01.rosters?.[player]).toEqual(side.roster);
      expect(PAPER_TEST_01.traps?.[player]).toEqual(side.traps);
      expect(SPEC_V0_2.rechargesPerPlayer).toBe(side.budget);
    }
    expect(paperTest01).toContain('Starter: A (fixed).');
    expect(PAPER_TEST_01.startingPlayer).toBe('A');
  });
});

describe('paper test 01 match replay (docs/paper-test-01.md, Phase A)', () => {
  const { state, steps } = replay();

  it('ends with B winning by Square on action 28', () => {
    expect(steps).toHaveLength(28);
    expect(state.result).toEqual({ kind: 'win', winner: 'B', reason: 'objective' });
    expect(steps[27]!.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'win', winner: 'B', reason: 'objective' } });
    expect(steps.slice(0, 27).every((step) => step.events.every((event) => event.kind !== 'match-ended'))).toBe(true);
  });

  it("has the report's legal-action count before every action", () => {
    expect(EXPECTED_COUNTS).toEqual(reportedCounts(paperTest01));
    expect(steps.map((step) => step.legalCount)).toEqual(EXPECTED_COUNTS);
  });

  it('triggers the four traps of the ledger, all as charge loss, and removes D2 by inspection on T11', () => {
    const triggers = steps.flatMap((step) =>
      step.events.flatMap((event) => (event.kind === 'trap-triggered' ? [`T${step.turn} ${event.owner}@${event.cell} ${event.fighter}`] : [])),
    );
    expect(triggers).toEqual(['T2 A@B2 B:Swapper', 'T8 A@C3 B:Puller', 'T15 B@A3 A:Teleporter', 'T28 B@B2 A:TerrainWeaver']);
    expect(steps.some((step) => step.events.some((event) => event.kind === 'lock-applied'))).toBe(false);
    expect(steps[10]!.events).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: 'A:TrapChecker', cell: 'D2', removed: 1 });
    // T4 and T26: B's own traps under B's fighters stay live and hidden.
    expect(steps[3]!.events.some((event) => event.kind === 'trap-triggered')).toBe(false);
    expect(steps[25]!.events.some((event) => event.kind === 'trap-triggered')).toBe(false);
  });

  it('reaches the final referee state of the report', () => {
    const at = (id: FighterId) => {
      const fighter = state.fighters.find((candidate) => candidate.id === id)!;
      return `${fighter.cell}(${fighter.charge})`;
    };
    expect(state.constraint).toEqual(parseTile('F-Mo'));
    expect(['A:Teleporter', 'A:TerrainWeaver', 'A:TrapChecker', 'A:Pusher'].map((id) => at(id as FighterId))).toEqual(['C2(0)', 'B2(0)', 'D1(1)', 'D3(0)']);
    expect(['B:Swapper', 'B:Upgrader', 'B:Trapper', 'B:Puller'].map((id) => at(id as FighterId))).toEqual(['B3(0)', 'A4(1)', 'A3(0)', 'B4(1)']);
    expect(state.recharges).toEqual({ A: 1, B: 1 });
    expect(state.traps).toEqual([]);
    expect(state.board).toEqual(PAPER_TEST_01.board);
  });

  it("keeps T11's inspection result in A's view only, and T20's trap cell from A until the end", () => {
    const afterT20 = replayTo(20);
    const viewA = playerView(afterT20, 'A');
    const viewB = playerView(afterT20, 'B');
    expect(viewA.inspections.map((inspection) => inspection.cell)).toEqual(['D2']);
    expect(viewB.inspections).toEqual([]);
    expect(viewB.log[10]!.events).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: 'A:TrapChecker', cell: 'D2', removed: null });
    // B was never told its D2 trap is gone (report R6), so B's view still lists it.
    expect(viewB.ownTraps.map((trap) => trap.cell)).toEqual(['D2', 'B2']);
    expect(viewA.log[19]!.action).toEqual({ kind: 'ability', fighter: 'B:Trapper', target: null });
    expect(viewA.ownTraps).toEqual([]);
  });
});

