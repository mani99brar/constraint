import { describe, expect, it } from 'vitest';
import { InvalidSetupError, listLegalActions, prepareMatch, startMatch, validateAction, validateSetup, type Action, type CellId, type FighterId } from '../api';
import { A, applied, B, construct, fighterOf, gridMatch, liveTraps, play, presetWith, TEST_PRESET, TEST_SETUPS, TEST_TILES, tile, withTraps } from './testing';

// The rule-variant switches of PRD §6 and the other provisional values of spec §13, read from the
// preset. GRID_BOARD: rows are terrains (A Forest, B Water, C Mountain, D Desert), columns
// symbols (1 Sun, 2 Moon, 3 Star, 4 Wave).

const ability = (fighter: FighterId, target: CellId): Action => ({ kind: 'ability', fighter, target });
const deploy = (fighter: FighterId, cell: CellId): Action => ({ kind: 'deploy', fighter, cell });

describe('variant: Puller may target allies (PRD §6; spec §9; paper test 01 R4)', () => {
  const state = (pullerMayTargetAllies: boolean) =>
    withTraps(
      construct(
        gridMatch({}, presetWith({ pullerMayTargetAllies })),
        { [B('Puller')]: 'A1', [B('Swapper')]: 'C1', [A('Pusher')]: 'A3' },
        { constraint: tile('Mountain', 'Star'), activePlayer: 'B', turn: 6 },
      ),
      [],
    );

  it('lets the Puller pull an ally by default', () => {
    expect(validateAction(state(true), ability(B('Puller'), 'C1'))).toBeNull();
    expect(fighterOf(play(state(true), ability(B('Puller'), 'C1')), B('Swapper')).cell).toBe('B1');
  });

  it('limits the Puller to enemies when switched off', () => {
    expect(validateAction(state(false), ability(B('Puller'), 'C1'))).toEqual({ code: 'invalid-target', fighter: B('Puller'), target: 'C1' });
    expect(validateAction(state(false), ability(B('Puller'), 'A3'))).toBeNull();
  });
});

describe('variant: locked fighters count toward the objective (PRD §6; spec §8.2, §10)', () => {
  const state = (lockedFightersCountTowardObjective: boolean) =>
    withTraps(
      construct(
        gridMatch({}, presetWith({ lockedFightersCountTowardObjective })),
        { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1', [B('Swapper')]: 'D2' },
        { constraint: tile('Forest', 'Moon'), turn: 7 },
        { [A('Pusher')]: { charge: 0, lock: { expiresAfterTurn: 8 } } },
      ),
      [],
    );

  it('counts a locked fighter toward Square by default', () => {
    expect(play(state(true), deploy(A('TerrainWeaver'), 'B2')).result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  it('does not count a locked fighter while it is locked when switched off; the Square wins once the lock expires', () => {
    const turn8 = play(state(false), deploy(A('TerrainWeaver'), 'B2'));
    expect(turn8.result).toBeNull();
    // The lock expires at the end of turn 8; B's next action is checked for both players.
    const afterB = play(turn8, { kind: 'move', fighter: B('Swapper'), cell: 'C2' });
    expect(afterB.result).toBeNull();
    expect(fighterOf(afterB, A('Pusher')).lock).toBeNull();
    const afterA = play(afterB, { kind: 'recharge', fighter: A('Pusher') });
    expect(afterA.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });
});

describe('variant: Anchor protection duration (PRD §6; spec §9; paper test 01 D2, R2)', () => {
  const ANCHOR_ROSTER = { A: ['Anchor', 'Pusher', 'TrapChecker', 'Teleporter'] as const };
  const anchored = (anchorProtection: 'through-opponent-next-turn' | 'through-owner-following-turn') => {
    const start = withTraps(
      construct(
        gridMatch(ANCHOR_ROSTER, presetWith({ anchorProtection })),
        { [A('Anchor')]: 'B2', [A('Pusher')]: 'B3', [B('Swapper')]: 'C3' },
        { constraint: tile('Water', 'Wave'), turn: 5 },
      ),
      [],
    );
    return applied(start, ability(A('Anchor'), 'B3'));
  };

  it("protects through the end of the opponent's next turn by default", () => {
    const { state, events } = anchored('through-opponent-next-turn');
    expect(events).toContainEqual({ kind: 'protection-applied', fighter: A('Pusher'), expiresAfterTurn: 6 });
    expect(validateAction(state, ability(B('Swapper'), 'B3'))?.code).toBe('invalid-target');
    const turn7 = play(state, deploy(B('Upgrader'), 'D2'));
    expect(fighterOf(turn7, A('Pusher')).protection).toBeNull();
  });

  it("also covers the owner's following turn when switched, which makes an already protected target reachable and illegal", () => {
    const { state, events } = anchored('through-owner-following-turn');
    expect(events).toContainEqual({ kind: 'protection-applied', fighter: A('Pusher'), expiresAfterTurn: 7 });
    expect(validateAction(state, ability(B('Swapper'), 'B3'))?.code).toBe('invalid-target');
    const turn7 = play(state, deploy(B('Upgrader'), 'D2'));
    expect(fighterOf(turn7, A('Pusher')).protection).toEqual({ expiresAfterTurn: 7, by: A('Anchor') });
    const recharged = construct(turn7, {}, {}, { [A('Anchor')]: { charge: 1 } });
    expect(validateAction(recharged, ability(A('Anchor'), 'B3'))?.code).toBe('invalid-target');
    expect(validateAction(recharged, ability(A('Anchor'), 'B2'))).toBeNull();
    const turn8 = play(recharged, ability(A('Anchor'), 'B2'));
    expect(fighterOf(turn8, A('Pusher')).protection).toBeNull();
  });
});

describe('variant: displacers per roster (PRD §6; paper test 01 B1)', () => {
  const twoDisplacers = { roster: ['Pusher', 'Puller', 'Anchor', 'Trapper'] as const, traps: ['A1', 'A2'] as const };

  it('allows any number of Pusher, Puller and Swapper by default', () => {
    expect(validateSetup({ roster: ['Pusher', 'Puller', 'Swapper', 'Trapper'], traps: ['A1', 'A2'] }, TEST_PRESET)).toEqual([]);
  });

  it('refuses a roster above the limit in validateSetup, and startMatch with it', () => {
    const preset = presetWith({ displacerLimit: 1 });
    expect(validateSetup(twoDisplacers, preset)).toEqual([{ code: 'displacer-limit', limit: 1, actual: 2 }]);
    expect(validateSetup({ ...twoDisplacers, roster: ['Pusher', 'Upgrader', 'Anchor', 'Trapper'] }, preset)).toEqual([]);
    const prepared = prepareMatch({ tiles: TEST_TILES, preset, seed: 1 });
    expect(() => startMatch(prepared, { A: twoDisplacers, B: TEST_SETUPS.B })).toThrow(InvalidSetupError);
  });
});

describe('preset values (spec §13; PRD §6)', () => {
  it('may refuse the same fighter type on both rosters', () => {
    const preset = presetWith({}, { sameTypesAcrossRosters: false });
    const prepared = prepareMatch({ tiles: TEST_TILES, preset, seed: 1 });
    const same = { A: TEST_SETUPS.A, B: { ...TEST_SETUPS.B, roster: ['Pusher', 'Upgrader', 'Puller', 'Trapper'] as const } };
    expect(() => startMatch(prepared, same)).toThrow(InvalidSetupError);
    expect(() => startMatch(prepared, TEST_SETUPS)).not.toThrow();
    expect(() => startMatch(prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed: 1 }), same)).not.toThrow();
  });

  it("may require the Trapper's destination to match, and may set the actor's tile as the constraint", () => {
    const position = (values: Parameters<typeof presetWith>[1]) =>
      withTraps(
        construct(gridMatch({}, presetWith({}, values)), { [B('Trapper')]: 'C2' }, { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 6 }),
        [],
      );
    const targets = (state: ReturnType<typeof position>) =>
      listLegalActions(state).flatMap((action) => (action.kind === 'ability' ? [action.target] : [])).sort();
    expect(targets(position({}))).toEqual(['B2', 'C1', 'C3', 'D2']);
    expect(targets(position({ trapperDestinationMustMatch: true }))).toEqual(['C1', 'C3']);
    expect(play(position({}), ability(B('Trapper'), 'C1')).constraint).toEqual(tile('Mountain', 'Wave'));
    const moved = play(position({ trapperKeepsConstraint: false }), ability(B('Trapper'), 'C1'));
    expect(moved.constraint).toEqual(tile('Mountain', 'Moon'));
    expect(liveTraps(moved)).toEqual(['B@C1']);
  });
});
