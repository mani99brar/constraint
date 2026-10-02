import { describe, expect, it } from 'vitest';
import {
  applyAction,
  listLegalActions,
  matchLogOf,
  parseMatchLog,
  prepareMatch,
  replayMatchLog,
  replayMatchSteps,
  startMatch,
  type Action,
  type MatchLog,
  type MatchState,
} from '@okiya/rules';
import { defaultSetup, PAPER_TEST_01_SWAPPED, PRESETS, SPEC_V0_2, TILES, validatePreset, validateScenario } from './index';

function playedMatch(actions: number): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed: 7 });
  let state = startMatch(prepared, { A: defaultSetup('A'), B: defaultSetup('B') });
  for (let i = 0; i < actions && !state.result; i += 1) {
    const applied = applyAction(state, listLegalActions(state)[0]!);
    if (!applied.ok) throw new Error('first legal action refused');
    state = applied.state;
  }
  return state;
}

/** A log as a loaded file gives it: plain JSON, no shared references. */
const asLoaded = (log: MatchLog): unknown => JSON.parse(JSON.stringify(log));

describe('parseMatchLog (PRD L3)', () => {
  it('accepts an exported log after a JSON round trip', () => {
    const log = matchLogOf(playedMatch(6));
    const parsed = parseMatchLog(asLoaded(log));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.log).toEqual(log);
  });

  it('names the offending field of a malformed log', () => {
    const log = asLoaded(matchLogOf(playedMatch(2))) as Record<string, unknown>;
    expect(parseMatchLog('not a log')).toEqual({ ok: false, refusal: { code: 'not-a-match-log', field: '' } });
    expect(parseMatchLog({ ...log, formatVersion: 99 })).toEqual({ ok: false, refusal: { code: 'unsupported-format-version', found: 99 } });
    expect(parseMatchLog({ ...log, seed: -1 })).toEqual({ ok: false, refusal: { code: 'not-a-match-log', field: 'seed' } });
    const setups = log.setups as Record<string, Record<string, unknown>>;
    expect(parseMatchLog({ ...log, setups: { ...setups, B: { ...setups.B, traps: 'A1' } } })).toEqual({
      ok: false,
      refusal: { code: 'not-a-match-log', field: 'setups.B.traps' },
    });
    expect(parseMatchLog({ ...log, actions: [{ fighter: 'A:Pusher' }] })).toEqual({
      ok: false,
      refusal: { code: 'not-a-match-log', field: 'actions.0' },
    });
  });
});

describe('replayMatchSteps (PRD L1, L3)', () => {
  it('returns the state after setup and after every action, ending where the match ended', () => {
    const final = playedMatch(6);
    const log = matchLogOf(final);
    const result = replayMatchSteps(log, TILES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states).toHaveLength(log.actions.length + 1);
    expect(result.states[0]!.history).toHaveLength(0);
    expect(result.states.at(-1)).toEqual(final);
    expect(replayMatchLog(log, TILES)).toEqual(final);
  });

  it('refuses an unknown action kind with its index instead of throwing', () => {
    const log = matchLogOf(playedMatch(3));
    const tampered: MatchLog = { ...log, actions: [...log.actions.slice(0, 2), { kind: 'teleport-anywhere' } as unknown as Action] };
    expect(replayMatchSteps(tampered, TILES)).toEqual({
      ok: false,
      refusal: { code: 'action-refused', actionIndex: 2, refusal: { code: 'unknown-action', kind: 'teleport-anywhere' } },
    });
  });

  it('refuses an illegal action with its index and reason', () => {
    const log = matchLogOf(playedMatch(2));
    const repeated: MatchLog = { ...log, actions: [log.actions[0]!, log.actions[0]!] };
    const result = replayMatchSteps(repeated, TILES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toMatchObject({ code: 'action-refused', actionIndex: 1 });
  });

  it('refuses an invalid setup with the setup refusals', () => {
    const log = matchLogOf(playedMatch(0));
    const roster = log.setups.A.roster;
    const duplicated: MatchLog = { ...log, setups: { ...log.setups, A: { ...log.setups.A, roster: [roster[0]!, roster[0]!, roster[2]!, roster[3]!] } } };
    const result = replayMatchSteps(duplicated, TILES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe('setup-refused');
  });
});

describe('built-in presets and scenarios', () => {
  it('every built-in preset is valid', () => {
    for (const preset of PRESETS) expect(validatePreset(preset), preset.id).toEqual([]);
  });

  it('the swapped paper test 01 scenario is valid, B starts and the rosters are swapped', () => {
    expect(validateScenario(PAPER_TEST_01_SWAPPED, SPEC_V0_2)).toEqual([]);
    expect(PAPER_TEST_01_SWAPPED.startingPlayer).toBe('B');
    expect(PAPER_TEST_01_SWAPPED.rosters?.A).toEqual(['Swapper', 'Upgrader', 'Puller', 'Trapper']);
  });
});
