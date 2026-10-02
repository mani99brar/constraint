import { describe, expect, it } from 'vitest';
import { applyAction, objectiveResult, type Action, type CellId, type Preset } from '@okiya/rules';
import { PRESETS, SPEC_V0_2, SPEC_V0_2_LOCKED_DONT_COUNT, SPEC_V0_2_REPETITION_2, validatePreset } from './index';
import { fid, fighter, must, play, position } from './paper-test-01.fixtures';

// The playtest presets on the paper test 01 fixture board (`docs/paper-test-01.md`):
//
//      1     2     3     4
//   A  F-Su  W-Mo  M-St  D-Wa
//   B  M-Wa  D-Su  F-Mo  W-St
//   C  W-Su  F-St  D-Mo  M-Mo
//   D  D-St  W-Wa  M-Su  F-Wa

const move = (fighter: string, cell: CellId): Action => ({ kind: 'move', fighter: fid(fighter), cell });
const recharge = (fighter: string): Action => ({ kind: 'recharge', fighter: fid(fighter) });
const ability = (fighter: string, target: CellId): Action => ({ kind: 'ability', fighter: fid(fighter), target });

describe('playtest presets (PRD P1, §6)', () => {
  it('are built in, valid, and differ from spec-v0.2 in one value each', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['spec-v0.2', 'spec-v0.2-locked-dont-count', 'spec-v0.2-repetition-2']),
    );
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    // The preset with spec-v0.2's id and name, so only the rule values are compared.
    const values = (preset: Preset): Preset => ({ ...preset, id: SPEC_V0_2.id, name: SPEC_V0_2.name });
    for (const preset of [SPEC_V0_2_LOCKED_DONT_COUNT, SPEC_V0_2_REPETITION_2]) {
      expect(PRESETS).toContain(preset);
      expect(validatePreset(preset), preset.id).toEqual([]);
      expect(preset.version).toBe(SPEC_V0_2.version);
    }
    expect(values(SPEC_V0_2_LOCKED_DONT_COUNT)).toEqual({
      ...SPEC_V0_2,
      variants: { ...SPEC_V0_2.variants, lockedFightersCountTowardObjective: false },
    });
    expect(values(SPEC_V0_2_REPETITION_2)).toEqual({ ...SPEC_V0_2, repetitionThreshold: 2 });
  });
});

describe("preset spec-v0.2-locked-dont-count: a lock expiring never wins on its own (spec §8.2, §10, §11 steps 7-8)", () => {
  // A holds A1, B1 and B2 of the square A1-A2-B1-B2; its spent Pusher walks into the hole A2
  // onto a B trap and is locked through A's turn 12. B's Swapper on C1 can swap with B1.
  const start = (preset: Preset) =>
    position({
      preset,
      active: 'A',
      turn: 10,
      constraint: 'W-Wa',
      fighters: { 'A:TP': 'A1', 'A:TC': 'B1 0', 'A:TW': 'B2', 'A:PU': 'A3 0', 'B:SW': 'C1', 'B:UP': 'D4' },
      traps: ['B@A2'],
    });

  it('wins at once under spec-v0.2, where the locked fighter counts', () => {
    const applied = must(applyAction(start(SPEC_V0_2), move('A:PU', 'A2')));
    expect(applied.events).toContainEqual({ kind: 'lock-applied', fighter: fid('A:PU'), expiresAfterTurn: 12 });
    expect(applied.state.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  // Turn 10 (A) completes the square with a lock; turn 11 (B) and turn 12 (A, the missed turn)
  // keep it; the lock expires at the end of turn 12.
  const expired = () => {
    const turn10 = must(applyAction(start(SPEC_V0_2_LOCKED_DONT_COUNT), move('A:PU', 'A2')));
    expect(turn10.events).toContainEqual({ kind: 'lock-applied', fighter: fid('A:PU'), expiresAfterTurn: 12 });
    expect(turn10.state.result).toBeNull();
    const turn11 = play(turn10.state, move('B:UP', 'C4'));
    expect(turn11.result).toBeNull();
    const turn12 = must(applyAction(turn11, recharge('A:TC')));
    return turn12;
  };

  it("does not end the match when the square's last lock expires at the end of the owner's turn", () => {
    const turn12 = expired();
    expect(turn12.state.result).toBeNull();
    expect(turn12.events.map((event) => event.kind)).not.toContain('match-ended');
    expect(fighter(turn12.state, 'A:PU').lock).toBeNull();
    expect(turn12.state.activePlayer).toBe('B');
    // The square would count now, but no objective check runs until an action resolves.
    expect(objectiveResult(turn12.state)).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  it("counts the square at the objective check after the opponent's next action", () => {
    const turn13 = must(applyAction(expired().state, move('B:UP', 'D4')));
    expect(turn13.state.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
    expect(turn13.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'win', winner: 'A', reason: 'objective' } });
  });

  it('lets the opponent break the square with that action instead', () => {
    const turn13 = play(expired().state, ability('B:SW', 'B1'));
    expect(fighter(turn13, 'A:TC').cell).toBe('C1');
    expect(turn13.result).toBeNull();
  });
});

describe('preset spec-v0.2-repetition-2 (spec §12)', () => {
  // Case 44's shuttle: A's TP A1 ⇄ B1 and B's SW D3 ⇄ D4 return to the start after four actions.
  const cycle = [move('A:TP', 'B1'), move('B:SW', 'D4'), move('A:TP', 'A1'), move('B:SW', 'D3')];
  const start = (preset: Preset) =>
    position({ preset, active: 'A', turn: 9, constraint: 'M-Su', fighters: { 'A:TP': 'A1', 'B:SW': 'D3' } });

  it('draws on the second occurrence of the same start-of-turn state', () => {
    const applied = must(applyAction(play(start(SPEC_V0_2_REPETITION_2), ...cycle.slice(0, 3)), cycle[3]!));
    expect(applied.state.result).toEqual({ kind: 'draw', reason: 'repetition' });
    expect(applied.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'draw', reason: 'repetition' } });
  });

  it('plays on after the same cycle under spec-v0.2', () => {
    expect(play(start(SPEC_V0_2), ...cycle).result).toBeNull();
  });
});
