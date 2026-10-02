import { describe, expect, it } from 'vitest';
import {
  applyAction,
  listLegalActions,
  matchLogOf,
  parseMatchLog,
  prepareMatch,
  replayMatchSteps,
  startMatch,
  type MatchLog,
  type MatchLogRefusal,
  type MatchState,
} from '../api';
import { GRID_BOARD, seededMatch, TEST_PRESET, TEST_SETUPS, TEST_TILES } from './testing';

// A saved match is restored from browser storage with `parseMatchLog` and `replayMatchSteps`, so
// whatever the stored value holds, the pair must refuse it with a structured reason, never throw.

/** Plays a fixed rotation through the legal-action list, as `determinism.test.ts` does. */
function played(state: MatchState, turns: number): MatchState {
  for (let i = 0; i < turns && !state.result; i += 1) {
    const legal = listLegalActions(state);
    const applied = applyAction(state, legal[(i * 7) % legal.length]!);
    if (!applied.ok) throw new Error('legal action refused');
    state = applied.state;
  }
  return state;
}

/** A match under a scenario that sets every scenario field, so each one is part of the log. */
function scenarioMatch(): MatchState {
  const scenario = {
    id: 'full',
    name: 'Every scenario field',
    board: GRID_BOARD,
    rosters: { A: TEST_SETUPS.A.roster, B: TEST_SETUPS.B.roster },
    traps: { A: ['A1', 'D4'], B: ['A4', 'D1'] },
    startingPlayer: 'B',
  } as const;
  const prepared = prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 3, scenario });
  return startMatch(prepared, TEST_SETUPS);
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A deep copy; the rules package has no DOM or Node types, so no `structuredClone`. */
const copyOf = <T extends Json>(value: T): T => JSON.parse(JSON.stringify(value));

/** The log as storage gives it back: plain JSON, no shared references. */
const asLoaded = (log: MatchLog): { [key: string]: Json } => JSON.parse(JSON.stringify(log));

const seededLog = () => asLoaded(matchLogOf(played(seededMatch(11), 12)));
const scenarioLog = () => asLoaded(matchLogOf(played(scenarioMatch(), 8)));

const refusal = (field: string): { ok: false; refusal: MatchLogRefusal } => ({ ok: false, refusal: { code: 'not-a-match-log', field } });

/** A copy of `value` with the value at `path` replaced by `apply`, or removed when it returns undefined. */
function mutated(value: Json, path: readonly (string | number)[], apply: (old: Json) => Json | undefined): Json | undefined {
  if (path.length === 0) return apply(value);
  const copy = copyOf(value) as Record<string | number, Json>;
  let parent = copy;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, Json>;
  const last = path.at(-1)!;
  const next = apply(parent[last]!);
  if (next !== undefined) parent[last] = next;
  else if (Array.isArray(parent)) parent.splice(last as number, 1);
  else delete parent[last];
  return copy;
}

/** Every path into a JSON value, the root included, parents before their children. */
function paths(value: Json, prefix: (string | number)[] = []): (string | number)[][] {
  const children =
    value === null || typeof value !== 'object'
      ? []
      : Array.isArray(value)
        ? value.flatMap((item, index) => paths(item, [...prefix, index]))
        : Object.entries(value).flatMap(([key, item]) => paths(item, [...prefix, key]));
  return [prefix, ...children];
}

/** One value of every JSON type, and the edge values the log's fields are checked against. */
const REPLACEMENTS: readonly Json[] = [null, true, false, 0, -1, 1.5, 2 ** 40, '', 'A1', 'Square', [], ['Pusher'], {}, { kind: 'move' }];

const REFUSAL_CODES = ['not-a-match-log', 'unsupported-format-version', 'setup-refused', 'action-refused'];

/**
 * What `parseMatchLog` then `replayMatchSteps` give for an untrusted value: a description of a
 * thrown error or a result that is not structured, or null when the result is structured.
 */
function unstructured(input: unknown): string | null {
  try {
    const parsed = parseMatchLog(input);
    if (!parsed.ok) return REFUSAL_CODES.includes(parsed.refusal.code) ? null : `parse refusal ${parsed.refusal.code}`;
    const replayed = replayMatchSteps(parsed.log, TEST_TILES);
    if (!replayed.ok) return REFUSAL_CODES.includes(replayed.refusal.code) ? null : `replay refusal ${replayed.refusal.code}`;
    return replayed.states.length === parsed.log.actions.length + 1 ? null : `${replayed.states.length} states`;
  } catch (error) {
    return `threw ${String(error)}`;
  }
}

describe('parseMatchLog refuses malformed contents with the offending field (PRD L3)', () => {
  it('accepts exported logs with and without a scenario after a JSON round trip', () => {
    for (const log of [seededLog(), scenarioLog()]) {
      const parsed = parseMatchLog(log);
      expect(parsed).toEqual({ ok: true, log });
      const replayed = replayMatchSteps(log as unknown as MatchLog, TEST_TILES);
      expect(replayed.ok).toBe(true);
    }
  });

  it('refuses a missing or mistyped preset key', () => {
    const log = seededLog();
    const values = (patch: (values: Record<string, Json>) => void) =>
      mutated(log, ['preset', 'values'], (old) => {
        const copy = copyOf(old) as Record<string, Json>;
        patch(copy);
        return copy;
      });
    expect(parseMatchLog(values((v) => delete v.rechargesPerPlayer))).toEqual(refusal('preset.values.rechargesPerPlayer'));
    expect(parseMatchLog(values((v) => delete v.name))).toEqual(refusal('preset.values.name'));
    expect(parseMatchLog(values((v) => delete v.variants))).toEqual(refusal('preset.values.variants'));
    expect(parseMatchLog(values((v) => (v.rechargesPerPlayer = '3')))).toEqual(refusal('preset.values.rechargesPerPlayer'));
    expect(parseMatchLog(values((v) => (v.trapsTriggerOnOpening = 'yes')))).toEqual(refusal('preset.values.trapsTriggerOnOpening'));
    expect(parseMatchLog(values((v) => (v.objectivePool = 'Square')))).toEqual(refusal('preset.values.objectivePool'));
    expect(parseMatchLog(values((v) => (v.terminalPrecedence = null)))).toEqual(refusal('preset.values.terminalPrecedence'));
    expect(parseMatchLog(values((v) => (v.variants = null)))).toEqual(refusal('preset.values.variants'));
    expect(parseMatchLog(values((v) => delete (v.variants as Record<string, Json>).pullerMayTargetAllies))).toEqual(
      refusal('preset.values.variants.pullerMayTargetAllies'),
    );
    expect(parseMatchLog(values((v) => ((v.variants as Record<string, Json>).anchorProtection = 1)))).toEqual(
      refusal('preset.values.variants.anchorProtection'),
    );
  });

  it('refuses an out-of-range preset number', () => {
    const log = seededLog();
    const withValue = (field: (string | number)[], value: Json) => mutated(log, ['preset', 'values', ...field], () => value);
    expect(parseMatchLog(withValue(['rosterSize'], 5))).toEqual(refusal('preset.values.rosterSize'));
    expect(parseMatchLog(withValue(['rechargesPerPlayer'], -1))).toEqual(refusal('preset.values.rechargesPerPlayer'));
    expect(parseMatchLog(withValue(['setupTrapsPerPlayer'], 17))).toEqual(refusal('preset.values.setupTrapsPerPlayer'));
    expect(parseMatchLog(withValue(['lockOwnTurnsMissed'], 1.5))).toEqual(refusal('preset.values.lockOwnTurnsMissed'));
    expect(parseMatchLog(withValue(['repetitionThreshold'], 1))).toEqual(refusal('preset.values.repetitionThreshold'));
    expect(parseMatchLog(withValue(['variants', 'displacerLimit'], 5))).toEqual(refusal('preset.values.variants.displacerLimit'));
  });

  it('refuses an unknown fighter type in a setup or a scenario roster', () => {
    expect(parseMatchLog(mutated(seededLog(), ['setups', 'A', 'roster', 1], () => 'Wizard'))).toEqual(refusal('setups.A.roster.1'));
    expect(parseMatchLog(mutated(seededLog(), ['setups', 'B', 'roster', 0], () => 7))).toEqual(refusal('setups.B.roster.0'));
    expect(parseMatchLog(mutated(scenarioLog(), ['scenario', 'rosters', 'B', 2], () => 'Wizard'))).toEqual(
      refusal('scenario.rosters.B.2'),
    );
    expect(parseMatchLog(mutated(scenarioLog(), ['scenario', 'rosters', 'A'], () => 'Pusher'))).toEqual(refusal('scenario.rosters.A'));
  });

  it('refuses an off-board cell in a setup or a scenario trap list', () => {
    expect(parseMatchLog(mutated(seededLog(), ['setups', 'B', 'traps', 0], () => 'E5'))).toEqual(refusal('setups.B.traps.0'));
    expect(parseMatchLog(mutated(seededLog(), ['setups', 'A', 'traps', 1], () => 'A0'))).toEqual(refusal('setups.A.traps.1'));
    expect(parseMatchLog(mutated(scenarioLog(), ['scenario', 'traps', 'A', 1], () => 'D5'))).toEqual(refusal('scenario.traps.A.1'));
  });

  it('refuses a malformed scenario board or scenario field', () => {
    const log = scenarioLog();
    expect(parseMatchLog(mutated(log, ['scenario', 'board', 'D4'], () => undefined))).toEqual(refusal('scenario.board.D4'));
    expect(parseMatchLog(mutated(log, ['scenario', 'board', 'B3', 'terrain'], () => 'Lava'))).toEqual(refusal('scenario.board.B3.terrain'));
    expect(parseMatchLog(mutated(log, ['scenario', 'board', 'C1', 'symbol'], () => null))).toEqual(refusal('scenario.board.C1.symbol'));
    // The 16 tiles once each (spec §3): a repeated tile is refused where it repeats.
    const repeated = mutated(log, ['scenario', 'board', 'A2'], () => ({ terrain: 'Forest', symbol: 'Sun' }));
    expect(parseMatchLog(repeated)).toEqual(refusal('scenario.board.A2'));
    expect(parseMatchLog(mutated(log, ['scenario', 'board'], () => []))).toEqual(refusal('scenario.board'));
    expect(parseMatchLog(mutated(log, ['scenario', 'board'], () => null))).toEqual(refusal('scenario.board'));
    expect(parseMatchLog(mutated(log, ['scenario', 'startingPlayer'], () => 'C'))).toEqual(refusal('scenario.startingPlayer'));
    expect(parseMatchLog(mutated(log, ['scenario', 'id'], () => undefined))).toEqual(refusal('scenario.id'));
    expect(parseMatchLog(mutated(log, ['scenario'], () => 'paper-test-01'))).toEqual(refusal('scenario'));
  });

  it('refuses an action whose fields are mistyped, and leaves unknown ids and cells to the replay', () => {
    const log = seededLog();
    expect(parseMatchLog(mutated(log, ['actions', 0, 'fighter'], () => 3))).toEqual(refusal('actions.0.fighter'));
    expect(parseMatchLog(mutated(log, ['actions', 0, 'cell'], () => undefined))).toEqual(refusal('actions.0.cell'));
    const offBoard = mutated(log, ['actions', 0, 'cell'], () => 'Z9');
    const parsed = parseMatchLog(offBoard);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(replayMatchSteps(parsed.log, TEST_TILES)).toEqual({
      ok: false,
      refusal: { code: 'action-refused', actionIndex: 0, refusal: { code: 'unknown-cell', cell: 'Z9' } },
    });
  });

  it('replayMatchSteps refuses a malformed log it is given without parsing, instead of throwing', () => {
    const log = mutated(seededLog(), ['preset', 'values', 'variants'], () => null) as unknown as MatchLog;
    expect(replayMatchSteps(log, TEST_TILES)).toEqual(refusal('preset.values.variants'));
  });
});

describe('a stored log mutated field by field (PRD L3)', () => {
  it('never makes parseMatchLog then replayMatchSteps throw, and always gives a structured result', () => {
    const failures: string[] = [];
    let mutations = 0;
    for (const log of [seededLog(), scenarioLog()]) {
      for (const path of paths(log)) {
        const variants = [...(path.length > 0 ? [() => undefined] : []), ...REPLACEMENTS.map((value) => () => value)];
        for (const variant of variants) {
          const input = mutated(log, path, variant);
          mutations += 1;
          const problem = unstructured(input);
          if (problem) failures.push(`${path.join('.')} = ${JSON.stringify(variant())}: ${problem}`);
        }
      }
    }
    expect(failures).toEqual([]);
    // Every field of both logs was visited: the preset, the scenario, the setups and the actions.
    expect(mutations).toBeGreaterThan(1000);
  });
});
