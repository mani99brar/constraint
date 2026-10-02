import { describe, expect, it } from 'vitest';
import {
  applyAction,
  blockadeResult,
  canonicalSignature,
  listLegalActions,
  objectiveResult,
  playerView,
  prepareMatch,
  projectEvents,
  startMatch,
  tileMatches,
  validateAction,
  type Action,
  type ActionRefusal,
  type CellId,
  type MatchState,
  type ResolutionEvent,
} from '@okiya/rules';
import { defaultSetup, PAPER_TEST_01, SPEC_V0_2, TILES } from './index';
import { fid, fighter, LEDGER, must, parseTile, play, position, replayTo } from './paper-test-01.fixtures';

// The 45 targeted edge cases of `docs/paper-simulation.md` §8, each built from its walkthrough in
// `docs/paper-test-01.md` (Phase B) on the fixture board, under preset spec-v0.2. "Match" cases use
// the replayed ledger state; "Synthetic" cases a constructed position. Where a hand-built state
// cannot exist or contradicts the spec, the test builds the nearest valid state with the same
// rule and outcome, and says what was wrong.
//
//      1     2     3     4
//   A  F-Su  W-Mo  M-St  D-Wa
//   B  M-Wa  D-Su  F-Mo  W-St
//   C  W-Su  F-St  D-Mo  M-Mo
//   D  D-St  W-Wa  M-Su  F-Wa

const deploy = (fighter: string, cell: CellId): Action => ({ kind: 'deploy', fighter: fid(fighter), cell });
const move = (fighter: string, cell: CellId): Action => ({ kind: 'move', fighter: fid(fighter), cell });
const recharge = (fighter: string): Action => ({ kind: 'recharge', fighter: fid(fighter) });
const ability = (fighter: string, target: CellId): Action => ({ kind: 'ability', fighter: fid(fighter), target });

/** The action is refused with this reason, is not offered, and costs nothing (spec §11 step 2). */
function expectRefusedWithoutCost(state: MatchState, action: Action, refusal: ActionRefusal['code']): void {
  const before = JSON.parse(JSON.stringify(state)) as MatchState;
  const applied = applyAction(state, action);
  expect(applied.ok).toBe(false);
  if (!applied.ok) expect(applied.refusal.code).toBe(refusal);
  expect(listLegalActions(state)).not.toContainEqual(action);
  expect(state).toEqual(before);
}

const sortActions = (actions: readonly Action[]) => actions.map((action) => JSON.stringify(action)).sort();
const kinds = (events: readonly ResolutionEvent[]) => events.map((event) => event.kind);
const liveTraps = (state: MatchState) => state.traps.map((trap) => `${trap.owner}@${trap.cell}`);
const totalCharge = (state: MatchState, owner: 'A' | 'B') =>
  state.fighters.filter((candidate) => candidate.owner === owner).reduce((sum, candidate) => sum + candidate.charge, 0);
/** A legal deploy, to pass a turn in a test without touching the position under test. */
const anyDeploy = (state: MatchState) => listLegalActions(state).find((action) => action.kind === 'deploy')!;

// Case 28's rebuilt position, B to move; case 42 reuses it.
// Walkthrough errors: its locked TP is charged, but a lock only follows a trap entered at charge
// 0 and a locked fighter cannot be recharged (spec §8.2); and its PU (charge 1, B4) could push
// the locked TP from matching C4 to D4, which §8.2 allows, so A was not blockaded. Rebuilt: A's
// TP sits locked at charge 0 on matching C4, A keeps one recharge (so only the lock stops the
// recharge), every other A fighter is spent on a non-matching tile with its matching
// neighbours filled, and B's Trapper hands over without changing M-Mo.
const blockadePosition = () =>
  position({
    active: 'B',
    turn: 30,
    constraint: 'M-Mo',
    fighters: {
      'A:TP': 'C4 0 L31',
      'A:PU': 'B4 0',
      'A:TC': 'D4 0',
      'A:TW': 'D2 0',
      'B:TR': 'B3',
      'B:SW': 'D3 0 L40',
      'B:UP': 'A3 0 L40',
      'B:PL': 'C3 0 L40',
    },
    recharges: { A: 1, B: 0 },
  });

describe('matching and ordinary actions (paper-simulation §8)', () => {
  it('case 1: a tile matching by terrain only is legal (match T12: D-St, UP A3→A4 on D-Wa)', () => {
    const state = replayTo(11);
    expect(state.constraint).toEqual(parseTile('D-St'));
    expect(state.board.A4).toEqual(parseTile('D-Wa'));
    expect(validateAction(state, move('B:UP', 'A4'))).toBeNull();
    expect(play(state, move('B:UP', 'A4')).constraint).toEqual(parseTile('D-Wa'));
  });

  it('case 2: a tile matching by symbol only is legal (match T7: F-Mo, TP A1→A2 on W-Mo)', () => {
    const state = replayTo(6);
    expect(state.constraint).toEqual(parseTile('F-Mo'));
    expect(validateAction(state, move('A:TP', 'A2'))).toBeNull();
    expect(play(state, move('A:TP', 'A2')).constraint).toEqual(parseTile('W-Mo'));
  });

  it('case 3: a tile matching neither is refused without spending anything or ending the turn (match T13: TP A2→A1 under D-Wa)', () => {
    const state = replayTo(12);
    expect(state.constraint).toEqual(parseTile('D-Wa'));
    expectRefusedWithoutCost(state, move('A:TP', 'A1'), 'no-match');
    expect(state.activePlayer).toBe('A');
    expect(listLegalActions(state)).toHaveLength(8);
  });

  it('case 4: a diagonal move is refused before matching is checked (W-Mo, PU D3→C2)', () => {
    const state = position({ active: 'A', turn: 9, constraint: 'W-Mo', fighters: { 'A:PU': 'D3' } });
    expectRefusedWithoutCost(state, move('A:PU', 'C2'), 'not-adjacent');
  });

  it('case 5: a move from a non-matching source to a matching destination is legal (match T14: SW B2→B1 under W-Wa)', () => {
    const state = replayTo(13);
    expect(tileMatches(state.board.B2, state.constraint!)).toBe(false);
    expect(validateAction(state, move('B:SW', 'B1'))).toBeNull();
  });

  // Walkthrough error: it calls D1, B2, C3 and A3 "all four D/St tiles", but under spec §6 a tile
  // matches D-St by terrain or symbol, and the fixture has seven: A3, A4, B2, B4, C2, C3, D1. The
  // rebuilt state also fills A4 (B:UP), B4 and C2; A's PU and TW stand there locked, so they add
  // no move, recharge or ability (spec §8.2), and A's TP waits charge 0 on non-matching D4.
  it('case 6: no empty matching tile but a legal recharge is not a blockade', () => {
    const state = position({
      active: 'A',
      turn: 30,
      constraint: 'D-St',
      fighters: {
        'A:TC': 'D1 0',
        'A:TW': 'C2 0 L32',
        'A:PU': 'B4 0 L32',
        'A:TP': 'D4 0',
        'B:SW': 'B2',
        'B:PL': 'C3',
        'B:TR': 'A3',
        'B:UP': 'A4',
      },
    });
    const matching = (Object.keys(state.board) as CellId[]).filter((cell) => tileMatches(state.board[cell], state.constraint!));
    expect(matching.sort()).toEqual(['A3', 'A4', 'B2', 'B4', 'C2', 'C3', 'D1']);
    expect(matching.every((cell) => state.fighters.some((candidate) => candidate.cell === cell))).toBe(true);
    expect(listLegalActions(state)).toEqual([recharge('A:TC')]);
    expect(blockadeResult(state)).toBeNull();
  });

  it('case 7: matching empty cells with no reserve and nobody able to reach them give no deployment (match T17)', () => {
    const state = replayTo(16);
    expect(state.constraint).toEqual(parseTile('M-Wa'));
    expect(state.fighters.filter((candidate) => candidate.owner === 'A').every((candidate) => candidate.cell !== null)).toBe(true);
    expect(['C4', 'D4'].every((cell) => tileMatches(state.board[cell as CellId], state.constraint!))).toBe(true);
    expect(sortActions(listLegalActions(state))).toEqual(sortActions([move('A:PU', 'D3'), recharge('A:TP')]));
  });

  it('case 8: an invalid ability target is refused and keeps the charge (match T9: PU pushes PL at C3 into occupied B3)', () => {
    const state = replayTo(8);
    expect(fighter(state, 'A:PU').charge).toBe(1);
    expectRefusedWithoutCost(state, ability('A:PU', 'C3'), 'invalid-target');
  });
});

describe('charges and support (paper-simulation §8)', () => {
  const upgraderPosition = (swapper = 'A2 0') =>
    position({
      active: 'B',
      turn: 30,
      constraint: 'M-St',
      fighters: { 'B:UP': 'A3', 'B:SW': swapper, 'B:TR': 'B3', 'B:PL': 'C3 0' },
    });

  it('case 9: Upgrader transfers its charge to an adjacent spent ally; total charge does not increase', () => {
    const state = upgraderPosition();
    const after = play(state, ability('B:UP', 'A2'));
    expect(fighter(after, 'B:UP').charge).toBe(0);
    expect(fighter(after, 'B:SW').charge).toBe(1);
    expect(totalCharge(after, 'B')).toBe(totalCharge(state, 'B'));
    expect(after.constraint).toEqual(parseTile('M-St'));
    expect(after.recharges).toEqual(state.recharges);
  });

  it('case 10: Upgrader cannot target itself, a charged ally, a non-adjacent ally or a locked ally', () => {
    const state = upgraderPosition();
    expectRefusedWithoutCost(state, ability('B:UP', 'A3'), 'invalid-target');
    expectRefusedWithoutCost(state, ability('B:UP', 'B3'), 'invalid-target');
    expectRefusedWithoutCost(state, ability('B:UP', 'C3'), 'invalid-target');
    expectRefusedWithoutCost(upgraderPosition('A2 0 L31'), ability('B:UP', 'A2'), 'invalid-target');
  });

  it('case 11: a shared recharge spends one budget unit and cannot exceed charge 1 (match T10 and T18)', () => {
    const before = replayTo(9);
    const applied = must(applyAction(before, recharge('B:PL')));
    expect(applied.state.recharges.B).toBe(2);
    expect(fighter(applied.state, 'B:PL').charge).toBe(1);
    expect(applied.events).toContainEqual({ kind: 'recharge-spent', player: 'B', remaining: 2 });
    const allCharged = replayTo(17);
    expect(fighter(allCharged, 'B:PL').charge).toBe(1);
    expectRefusedWithoutCost(allCharged, recharge('B:PL'), 'already-charged');
  });

  it('case 12: a fighter at charge 0 may still move (match T14 SW and T24 TR)', () => {
    const t14 = replayTo(13);
    expect(fighter(t14, 'B:SW').charge).toBe(0);
    expect(validateAction(t14, move('B:SW', 'B1'))).toBeNull();
    const t24 = replayTo(23);
    expect(fighter(t24, 'B:TR').charge).toBe(0);
    expect(validateAction(t24, move('B:TR', 'A3'))).toBeNull();
  });
});

describe('traps (paper-simulation §8)', () => {
  it('case 13: an own fighter entering an own trap is not revealed, consumed or penalised (match T4 and T26)', () => {
    for (const [count, trap] of [
      [3, 'B@A3'],
      [25, 'B@B2'],
    ] as const) {
      const applied = must(applyAction(replayTo(count), LEDGER[count]!));
      expect(kinds(applied.events)).not.toContain('trap-triggered');
      expect(liveTraps(applied.state)).toContain(trap);
      expect(kinds(applied.events).filter((kind) => kind.startsWith('trap'))).toEqual([]);
    }
  });

  it('case 14: an enemy at charge 1 consumes the trap and loses its charge, without a lock (match T2, T8, T15, T28)', () => {
    for (const count of [1, 7, 14, 27]) {
      const before = replayTo(count);
      const applied = must(applyAction(before, LEDGER[count]!));
      const triggered = applied.events.filter((event) => event.kind === 'trap-triggered');
      expect(triggered).toHaveLength(1);
      expect(kinds(applied.events)).toContain('charge-lost');
      expect(kinds(applied.events)).not.toContain('lock-applied');
      expect(applied.state.traps).toHaveLength(before.traps.length - 1);
    }
  });

  it("case 15: an enemy at charge 0 consumes the trap and is locked with an explicit expiry (B's turn 30, PL pulls TC onto a B trap)", () => {
    const state = position({ active: 'B', turn: 30, constraint: 'W-Wa', fighters: { 'B:PL': 'A1', 'A:TC': 'C1 0' }, traps: ['B@B1'] });
    const applied = must(applyAction(state, ability('B:PL', 'C1')));
    expect(fighter(applied.state, 'A:TC').cell).toBe('B1');
    expect(applied.events).toContainEqual({ kind: 'lock-applied', fighter: 'A:TrapChecker', expiresAfterTurn: 31 });
    expect(applied.state.traps).toEqual([]);
    // Triggered on the opponent's turn: it covers A's turn 31 and is gone after it (spec §8.2).
    const turn31 = applied.state;
    expectRefusedWithoutCost(turn31, move('A:TC', 'A1'), 'fighter-locked');
    const turn32 = play(turn31, anyDeploy(turn31));
    expect(turn32.turn).toBe(32);
    expect(fighter(turn32, 'A:TC').lock).toBeNull();
  });

  it("case 16: a Teleporter spends its charge first, so landing on an enemy trap locks it (A's turn 30, W-Su, TP to C1)", () => {
    const state = position({ active: 'A', turn: 30, constraint: 'W-Su', fighters: { 'A:TP': 'D4' }, traps: ['B@C1'] });
    const applied = must(applyAction(state, ability('A:TP', 'C1')));
    expect(kinds(applied.events).slice(0, 4)).toEqual(['charge-spent', 'fighter-entered', 'trap-triggered', 'lock-applied']);
    expect(applied.events).toContainEqual({ kind: 'lock-applied', fighter: 'A:Teleporter', expiresAfterTurn: 32 });
    // Triggered on its owner's turn: it misses exactly A's turn 32.
    const turn32 = play(applied.state, anyDeploy(applied.state));
    expect(fighter(turn32, 'A:TP').lock).toEqual({ expiresAfterTurn: 32 });
    expectRefusedWithoutCost(turn32, move('A:TP', 'B1'), 'fighter-locked');
    expect(fighter(play(turn32, anyDeploy(turn32)), 'A:TP').lock).toBeNull();
  });

  it('case 17: a swap onto two hostile traps resolves both entries before the objective check', () => {
    const state = position({
      active: 'B',
      turn: 30,
      constraint: 'D-Mo',
      fighters: { 'B:SW': 'B3', 'A:PU': 'C3' },
      traps: ['B@B3', 'A@C3'],
    });
    const applied = must(applyAction(state, ability('B:SW', 'C3')));
    expect(applied.events).toEqual([
      { kind: 'charge-spent', fighter: 'B:Swapper' },
      { kind: 'fighter-entered', fighter: 'B:Swapper', from: 'B3', to: 'C3', entry: 'swap' },
      { kind: 'fighter-entered', fighter: 'A:Pusher', from: 'C3', to: 'B3', entry: 'swap' },
      { kind: 'trap-triggered', trapId: 'A-setup-2', owner: 'A', cell: 'C3', fighter: 'B:Swapper' },
      { kind: 'lock-applied', fighter: 'B:Swapper', expiresAfterTurn: 32 },
      { kind: 'trap-triggered', trapId: 'B-setup-1', owner: 'B', cell: 'B3', fighter: 'A:Pusher' },
      { kind: 'charge-lost', fighter: 'A:Pusher' },
      { kind: 'constraint-set', constraint: parseTile('D-Mo') },
    ]);
    expect(applied.state.traps).toEqual([]);
  });

  it('case 18: with opposing traps overlapping, the entrant triggers only the enemy trap', () => {
    const state = position({ active: 'A', turn: 30, constraint: 'W-St', fighters: { 'A:TC': 'C2' }, traps: ['A@C1', 'B@C1'] });
    const applied = must(applyAction(state, move('A:TC', 'C1')));
    expect(applied.events.filter((event) => event.kind === 'trap-triggered')).toEqual([
      { kind: 'trap-triggered', trapId: 'B-setup-2', owner: 'B', cell: 'C1', fighter: 'A:TrapChecker' },
    ]);
    expect(liveTraps(applied.state)).toEqual(['A@C1']);
  });

  it('case 19: pushing an enemy onto your trap triggers it normally', () => {
    const state = position({ active: 'A', turn: 30, constraint: 'D-St', fighters: { 'A:PU': 'B1', 'B:SW': 'B2' }, traps: ['A@B3'] });
    const applied = must(applyAction(state, ability('A:PU', 'B2')));
    expect(fighter(applied.state, 'B:SW')).toMatchObject({ cell: 'B3', charge: 0 });
    expect(applied.events).toContainEqual({ kind: 'trap-triggered', trapId: 'A-setup-1', owner: 'A', cell: 'B3', fighter: 'B:Swapper' });
    expect(applied.state.constraint).toEqual(parseTile('F-Mo'));
  });

  it('case 20: a locked fighter still counts toward Square', () => {
    const state = position({ active: 'A', turn: 31, constraint: 'D-Su', fighters: { 'A:TP': 'C1', 'A:TW': 'C2', 'A:PU': 'D2 0 L32' } });
    const after = play(state, deploy('A:TC', 'D1'));
    expect(fighter(after, 'A:PU').lock).not.toBeNull();
    expect(after.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  it('case 21: another fighter may displace a locked fighter, and the lock persists', () => {
    const state = position({ active: 'B', turn: 30, constraint: 'D-Wa', fighters: { 'B:PL': 'B1', 'A:TC': 'D1 0 L31' } });
    const after = play(state, ability('B:PL', 'D1'));
    expect(fighter(after, 'A:TC')).toMatchObject({ cell: 'C1', lock: { expiresAfterTurn: 31 } });
  });

  it('case 22: a Trapper placing beneath an ally triggers nothing (T20 variant, PL on B4)', () => {
    const t20 = replayTo(19);
    const state = { ...t20, fighters: t20.fighters.map((f) => (f.id === fid('B:PL') ? { ...f, cell: 'B4' as const } : f)) };
    const applied = must(applyAction(state, ability('B:TR', 'B4')));
    expect(kinds(applied.events)).not.toContain('trap-triggered');
    expect(liveTraps(applied.state)).toContain('B@B4');
    expect(fighter(applied.state, 'B:PL')).toEqual(fighter(state, 'B:PL'));
  });

  it('case 23: a Trapper cannot place beneath an enemy or stack a second own trap (T20 state)', () => {
    const t20 = replayTo(19);
    expectRefusedWithoutCost(t20, ability('B:TR', 'A3'), 'invalid-target');
    expectRefusedWithoutCost(t20, ability('B:TR', 'C3'), 'invalid-target');
    const ownTrap = { id: 'B-test', owner: 'B' as const, cell: 'B4' as const };
    const stacked: MatchState = {
      ...t20,
      traps: [...t20.traps, ownTrap],
      trapHistory: [...t20.trapHistory, { ...ownTrap, source: 'setup', placedOnTurn: 0, placedBy: null, fate: { kind: 'live' } }],
    };
    expectRefusedWithoutCost(stacked, ability('B:TR', 'B4'), 'invalid-target');
    expect(validateAction(stacked, ability('B:TR', 'B2'))).toBeNull();
  });

  it('case 24: a Trapper placement keeps the constraint and hides its cell from the other side (match T20)', () => {
    const state = replayTo(20);
    expect(state.constraint).toEqual(parseTile('D-Mo'));
    const entry = playerView(state, 'A').log[19]!;
    expect(entry.action).toEqual({ kind: 'ability', fighter: 'B:Trapper', target: null });
    expect(entry.events).toEqual([
      { kind: 'charge-spent', fighter: 'B:Trapper' },
      { kind: 'trap-placed', owner: 'B', cell: null },
    ]);
  });

  it('case 25: Trap Checker removes the enemy trap in its chosen cell and spares the friendly one; ally cells are not selectable', () => {
    const state = position({
      active: 'A',
      turn: 30,
      constraint: 'D-Wa',
      fighters: { 'A:TC': 'D1', 'A:PU': 'D2' },
      traps: ['A@C1', 'B@C1'],
    });
    const applied = must(applyAction(state, ability('A:TC', 'C1')));
    expect(liveTraps(applied.state)).toEqual(['A@C1']);
    expect(applied.events).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: 'A:TrapChecker', cell: 'C1', removed: 1 });
    expectRefusedWithoutCost(state, ability('A:TC', 'D2'), 'invalid-target');
  });

  it('case 26: Trap Checker finding nothing still spends its charge and action (T11 state, C1)', () => {
    const state = replayTo(10);
    const applied = must(applyAction(state, ability('A:TC', 'C1')));
    expect(fighter(applied.state, 'A:TC').charge).toBe(0);
    expect(applied.state.activePlayer).toBe('B');
    expect(applied.state.constraint).toEqual(parseTile('D-St'));
    expect(playerView(applied.state, 'A').inspections.at(-1)).toMatchObject({ cell: 'C1', removedTrapIds: [] });
    expect(projectEvents(applied.events, 'B')).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: 'A:TrapChecker', cell: 'C1', removed: null });
  });

  it('case 27: a setup trap on the opening cell triggers on the opening deployment', () => {
    const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed: 1, scenario: PAPER_TEST_01 });
    const state = startMatch(prepared, { A: defaultSetup('A'), B: defaultSetup('B') }, { id: 'case-27', name: 'Case 27', traps: { B: ['A1', 'D2'] } });
    const applied = must(applyAction(state, deploy('A:TP', 'A1')));
    expect(applied.events).toContainEqual({ kind: 'trap-triggered', trapId: 'B-setup-1', owner: 'B', cell: 'A1', fighter: 'A:Teleporter' });
    expect(fighter(applied.state, 'A:TP').charge).toBe(0);
  });

  it('case 28: a lock that leaves no legal action at the owner\'s next turn makes the owner lose rather than skip', () => {
    const applied = must(applyAction(blockadePosition(), ability('B:TR', 'B2')));
    expect(applied.state.constraint).toEqual(parseTile('M-Mo'));
    expect(applied.state.result).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
    // The lock is the proximate reason: unlocked, the TP could be recharged on C4.
    const unlocked = { ...applied.state, result: null, fighters: applied.state.fighters.map((f) => (f.id === fid('A:TP') ? { ...f, lock: null } : f)) };
    expect(listLegalActions(unlocked)).toEqual([recharge('A:TP')]);
  });
});

describe('displacement, protection and terrain (paper-simulation §8)', () => {
  it('case 29: a push onto an occupied cell or off the board is refused without cost (match T9 and T21)', () => {
    expectRefusedWithoutCost(replayTo(8), ability('A:PU', 'C3'), 'invalid-target');
    const t21 = replayTo(20);
    expect(fighter(t21, 'A:PU').cell).toBe('D2');
    expect(fighter(t21, 'A:TC').cell).toBe('D1');
    expect(tileMatches(t21.board.D1, t21.constraint!)).toBe(true);
    expectRefusedWithoutCost(t21, ability('A:PU', 'D1'), 'invalid-target');
  });

  it('case 30: a pull with an occupied intervening cell is refused (match T18: PL C3 → TP A3 across TR on B3)', () => {
    const state = replayTo(17);
    expect(tileMatches(state.board.A3, state.constraint!)).toBe(true);
    expectRefusedWithoutCost(state, ability('B:PL', 'A3'), 'invalid-target');
  });

  it('case 31: a push whose target matches but destination does not is legal and sets the constraint from the destination (match T27)', () => {
    const state = replayTo(26);
    expect(state.constraint).toEqual(parseTile('D-Su'));
    const after = play(state, ability('A:PU', 'C3'));
    expect(fighter(after, 'A:TW').cell).toBe('B3');
    expect(tileMatches(after.board.B3, parseTile('D-Su'))).toBe(false);
    expect(after.constraint).toEqual(parseTile('F-Mo'));
  });

  const ANCHOR_ROSTER = { A: ['Anchor', 'TrapChecker', 'Pusher', 'Teleporter'] as const };

  // Walkthrough error: after the Anchor on C2 acts, the constraint is its tile F-St (spec §9
  // Anchor), which TC's D2 (W-Wa) does not match, so the enemy swap and pull would fail on
  // matching, not on protection. On the fixture only B3–C3 and C3–C4 are adjacent tiles sharing
  // an attribute, so the rebuilt Anchor stands on C3 (D-Mo) and protects TC on C4 (M-Mo).
  it('case 32: Anchor blocks enemy swap and pull on the protected target', () => {
    const start = position({
      active: 'A',
      turn: 30,
      constraint: 'D-St',
      rosters: ANCHOR_ROSTER,
      fighters: { 'A:AN': 'C3', 'A:TC': 'C4', 'B:SW': 'D4', 'B:PL': 'A4' },
    });
    const turn31 = play(start, ability('A:AN', 'C4'));
    expect(fighter(turn31, 'A:TC').protection).toEqual({ expiresAfterTurn: 31, by: 'A:Anchor' });
    expect(turn31.constraint).toEqual(parseTile('D-Mo'));
    expectRefusedWithoutCost(turn31, ability('B:SW', 'C4'), 'invalid-target');
    expectRefusedWithoutCost(turn31, ability('B:PL', 'C4'), 'invalid-target');
    const unprotected = { ...turn31, fighters: turn31.fighters.map((f) => (f.id === fid('A:TC') ? { ...f, protection: null } : f)) };
    expect(validateAction(unprotected, ability('B:SW', 'C4'))).toBeNull();
    expect(validateAction(unprotected, ability('B:PL', 'C4'))).toBeNull();
  });

  // Walkthrough error: under spec §9's duration (through the end of the opponent's next turn) the
  // protection is gone before A acts again, so an ally can never displace a protected fighter.
  // Rebuilt under the preset's `through-owner-following-turn` variant (PRD §6), with the case 32
  // geometry: PU on B4 pushes the protected TC from C4 onto B's trap on D4.
  it('case 33: Anchor does not prevent allied displacement or trap effects', () => {
    const preset = { ...SPEC_V0_2, variants: { ...SPEC_V0_2.variants, anchorProtection: 'through-owner-following-turn' as const } };
    const start = position({
      active: 'A',
      turn: 30,
      constraint: 'D-St',
      rosters: ANCHOR_ROSTER,
      fighters: { 'A:AN': 'C3', 'A:TC': 'C4', 'A:PU': 'B4' },
      traps: ['B@D4'],
      preset,
    });
    const turn32 = play(start, ability('A:AN', 'C4'), deploy('B:SW', 'B3'));
    expect(fighter(turn32, 'A:TC').protection).toEqual({ expiresAfterTurn: 32, by: 'A:Anchor' });
    const applied = must(applyAction(turn32, ability('A:PU', 'C4')));
    expect(fighter(applied.state, 'A:TC')).toMatchObject({ cell: 'D4', charge: 0 });
    expect(applied.events).toContainEqual({ kind: 'trap-triggered', trapId: 'B-setup-1', owner: 'B', cell: 'D4', fighter: 'A:TrapChecker' });
  });

  it("case 34: Anchor protection expires after the opponent's next turn", () => {
    const start = position({ active: 'A', turn: 30, constraint: 'D-St', rosters: ANCHOR_ROSTER, fighters: { 'A:AN': 'C3', 'A:TC': 'C4' } });
    const applied = must(applyAction(start, ability('A:AN', 'C4')));
    expect(applied.events).toContainEqual({ kind: 'protection-applied', fighter: 'A:TrapChecker', expiresAfterTurn: 31 });
    expect(fighter(applied.state, 'A:TC').protection).not.toBeNull();
    const turn32 = play(applied.state, deploy('B:SW', 'B3'));
    expect(turn32.turn).toBe(32);
    expect(fighter(turn32, 'A:TC').protection).toBeNull();
    // With its charge back, the Anchor could re-target it: the "already protected" clause never fires.
    const recharged = { ...turn32, fighters: turn32.fighters.map((f) => (f.id === fid('A:AN') ? { ...f, charge: 1 as const } : f)) };
    expect(validateAction(recharged, ability('A:AN', 'C4'))).toBeNull();
  });

  const weaverPosition = () =>
    position({ active: 'A', turn: 30, constraint: 'D-St', fighters: { 'A:TW': 'C3', 'B:TR': 'B3' }, traps: ['B@B3', 'A@C3'] });

  it('case 35: Terrain Weaver exchanges tiles only; fighters and traps stay at their coordinates', () => {
    const after = play(weaverPosition(), ability('A:TW', 'B3'));
    expect(after.board.C3).toEqual(parseTile('F-Mo'));
    expect(after.board.B3).toEqual(parseTile('D-Mo'));
    expect(fighter(after, 'B:TR').cell).toBe('B3');
    expect(fighter(after, 'A:TW').cell).toBe('C3');
    expect(liveTraps(after).sort()).toEqual(['A@C3', 'B@B3']);
  });

  it('case 36: a terrain exchange does not trigger a trap beneath a stationary fighter', () => {
    const applied = must(applyAction(weaverPosition(), ability('A:TW', 'B3')));
    expect(kinds(applied.events)).toEqual(['charge-spent', 'terrain-exchanged', 'constraint-set']);
  });

  it('case 37: Terrain Weaver sets the constraint from the new tile beneath itself', () => {
    const after = play(weaverPosition(), ability('A:TW', 'B3'));
    expect(after.constraint).toEqual(parseTile('F-Mo'));
  });
});

describe('endings and repetition (paper-simulation §8)', () => {
  it('case 38: the acting player completing its own Square wins at once, with no final-response turn (match T28)', () => {
    const state = replayTo(28);
    expect(state.result).toEqual({ kind: 'win', winner: 'B', reason: 'objective' });
    expect(listLegalActions(state)).toEqual([]);
    expect(applyAction(state, move('A:TC', 'D2'))).toEqual({ ok: false, refusal: { code: 'match-over' } });
  });

  it("case 39: a displacement completing only the opponent's Square makes the opponent win", () => {
    const state = position({
      active: 'B',
      turn: 30,
      constraint: 'F-Su',
      fighters: { 'A:TP': 'A1', 'A:TC': 'A2', 'A:TW': 'B1', 'A:PU': 'B3', 'B:SW': 'B2' },
    });
    expect(play(state, ability('B:SW', 'B3')).result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  // Synthetic, not claimed reachable (paper-test-01.md, case 40): a direct state-based test.
  const bothSquaresPosition = (aFighters: Record<string, string>) =>
    position({
      active: 'B',
      turn: 30,
      constraint: 'F-Su',
      fighters: { ...aFighters, 'B:SW': 'B2', 'B:UP': 'B4', 'B:PL': 'C3', 'B:TR': 'C4' },
      recharges: { A: 0, B: 3 },
    });

  it('case 40: both objectives satisfied after one action is a draw (synthetic)', () => {
    const state = bothSquaresPosition({ 'A:TP': 'A1', 'A:TC': 'A2', 'A:TW': 'B1', 'A:PU': 'B3' });
    expect(play(state, ability('B:SW', 'B3')).result).toEqual({ kind: 'draw', reason: 'simultaneous-objective' });
  });

  it("case 41: an objective and the next player's blockade together: the objective has priority", () => {
    const state = bothSquaresPosition({ 'A:TP': 'B3 0', 'A:PU': 'A2 0', 'A:TC': 'C2 0', 'A:TW': 'A1 0' });
    const after = play(state, ability('B:SW', 'B3'));
    expect(after.result).toEqual({ kind: 'win', winner: 'B', reason: 'objective' });
    const handedOver = { ...after, result: null, activePlayer: 'A' as const, turn: after.turn + 1 };
    expect(listLegalActions(handedOver)).toEqual([]);
    expect(objectiveResult(after)).toEqual({ kind: 'win', winner: 'B', reason: 'objective' });
  });

  // Walkthrough error: it reuses case 28's state, which was not a blockade (see case 28). Rebuilt
  // on the corrected case 28 position: after B's Trapper acts, neither side has a legal action.
  it('case 42: when both players have no legal action, the active player loses; it is not a draw', () => {
    const applied = must(applyAction(blockadePosition(), ability('B:TR', 'B2')));
    expect(applied.state.activePlayer).toBe('A');
    expect(listLegalActions({ ...applied.state, result: null })).toEqual([]);
    expect(listLegalActions({ ...applied.state, result: null, activePlayer: 'B' })).toEqual([]);
    expect(applied.state.result).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
  });

  // Walkthrough error: S8 and S10 do not share fighter cells, since A deployed TC to D1 on T9
  // (and S14 and S16 differ by TP's T15 move). The case is rebuilt on S10 itself: each variant
  // keeps every fighter cell and changes one other component of the full state (spec §12).
  it('case 43: the same fighter positions with different charges, terrain, traps or constraint are different states', () => {
    const s8 = replayTo(8);
    const s10 = replayTo(10);
    expect(fighter(s8, 'A:TC').cell).toBeNull();
    expect(fighter(s10, 'A:TC').cell).toBe('D1');
    const signature = canonicalSignature(s10);
    const withFighter = (patch: object) => s10.fighters.map((f) => (f.id === fid('B:PL') ? { ...f, ...patch } : f));
    const removedD2 = s10.trapHistory.find((record) => record.cell === 'D2')!;
    const variants: MatchState[] = [
      { ...s10, fighters: withFighter({ charge: 0 }), recharges: { ...s10.recharges, B: 3 } },
      { ...s10, traps: [...s10.traps, { id: removedD2.id, owner: removedD2.owner, cell: removedD2.cell }] },
      { ...s10, board: { ...s10.board, A1: s10.board.B1, B1: s10.board.A1 } },
      { ...s10, constraint: parseTile('D-St') },
    ];
    for (const variant of variants) expect(canonicalSignature(variant)).not.toBe(signature);
    expect(canonicalSignature({ ...s10, turn: s10.turn + 4, history: [] })).toBe(signature);
    const replayed = replayTo(27);
    expect(new Set(replayed.repetition).size).toBe(replayed.repetition.length);
  });

  // Walkthrough error: B's shuttle A2 ⇄ B3 is diagonal, and movement is orthogonal (spec §3,
  // §7.2). Rebuilt with A's TP shuttling A1 ⇄ B1 and B's SW shuttling D3 ⇄ D4: each hop matches
  // the tile the previous hop set (M-Su → M-Wa → F-Wa → F-Su → M-Su, spec §6), and nothing else changes.
  it('case 44: the third occurrence of the full start-of-turn state is a draw', () => {
    const start = position({ active: 'A', turn: 9, constraint: 'M-Su', fighters: { 'A:TP': 'A1', 'B:SW': 'D3' } });
    const cycle = [move('A:TP', 'B1'), move('B:SW', 'D4'), move('A:TP', 'A1'), move('B:SW', 'D3')];
    const once = play(start, ...cycle);
    expect(canonicalSignature(once)).toBe(canonicalSignature(start));
    expect(once.result).toBeNull();
    const twiceButOne = play(once, ...cycle.slice(0, 3));
    expect(twiceButOne.result).toBeNull();
    const applied = must(applyAction(twiceButOne, cycle[3]!));
    expect(applied.state.result).toEqual({ kind: 'draw', reason: 'repetition' });
    expect(applied.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'draw', reason: 'repetition' } });
    expect(applied.state.repetition.filter((signature) => signature === canonicalSignature(start))).toHaveLength(3);
  });

  it('case 45: locks with equal remaining duration compare equal at different absolute turns', () => {
    // A lock triggered on B's turn 9 expires after A's turn 10.
    const pulled = play(
      position({ active: 'B', turn: 9, constraint: 'W-Wa', fighters: { 'B:PL': 'A1', 'A:TP': 'C1 0' }, traps: ['B@B1'] }),
      ability('B:PL', 'C1'),
    );
    expect(fighter(pulled, 'A:TP').lock).toEqual({ expiresAfterTurn: 10 });
    // A lock triggered by A's own teleport on turn 20 expires after A's turn 22.
    const teleported = play(
      position({ active: 'A', turn: 20, constraint: 'W-Su', fighters: { 'A:TP': 'D4' }, traps: ['B@C1'] }),
      ability('A:TP', 'C1'),
    );
    expect(fighter(teleported, 'A:TP').lock).toEqual({ expiresAfterTurn: 22 });
    const startOfB21 = teleported;
    const startOfA22 = play(startOfB21, anyDeploy(startOfB21));
    // Start of A-10 and start of A-22: "this turn" remains for both, so the same position compares equal.
    const shifted = (state: MatchState, turn: number, lock: number) => ({
      ...state,
      turn,
      fighters: state.fighters.map((f) => (f.id === fid('A:TP') ? { ...f, lock: { expiresAfterTurn: lock } } : f)),
    });
    expect(canonicalSignature(shifted(startOfA22, 10, 10))).toBe(canonicalSignature(startOfA22));
    expect(fighter(pulled, 'A:TP').lock!.expiresAfterTurn - pulled.turn).toBe(0);
    // Start of B-21: "the owner's next turn" remains, which differs from "this turn".
    expect(canonicalSignature(shifted(startOfB21, 21, 21))).not.toBe(canonicalSignature(startOfB21));
  });
});
