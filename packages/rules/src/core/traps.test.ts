import { describe, expect, it } from 'vitest';
import { listLegalActions, validateAction, type Action, type CellId, type EntryMode, type FighterId, type MatchState } from '../api';
import { A, applied, B, construct, fighterOf, gridMatch, liveTraps, play, presetWith, tile, withTraps } from './testing';

// GRID_BOARD: rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols
// (1 Sun, 2 Moon, 3 Star, 4 Wave), so a constraint matches its terrain's row and its symbol's column.

const ability = (fighter: FighterId, target: CellId): Action => ({ kind: 'ability', fighter, target });
const move = (fighter: FighterId, cell: CellId): Action => ({ kind: 'move', fighter, cell });
const deploy = (fighter: FighterId, cell: CellId): Action => ({ kind: 'deploy', fighter, cell });
const triggers = (events: readonly { kind: string }[]) => events.filter((event) => event.kind === 'trap-triggered');

describe('trap trigger (spec §8.1)', () => {
  // One position per entry mode; each ends with B's fighter entering A's trap on B4.
  const entries: readonly [EntryMode, MatchState, Action][] = [
    ['deploy', construct(gridMatch(), {}, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 4 }), deploy(B('Swapper'), 'B4')],
    ['move', construct(gridMatch(), { [B('Swapper')]: 'B3' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 4 }), move(B('Swapper'), 'B4')],
    ['teleport', construct(gridMatch({ B: ['Teleporter', 'Upgrader', 'Puller', 'Trapper'] }), { [B('Teleporter')]: 'D1' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 4 }), ability(B('Teleporter'), 'B4')],
    ['push', construct(gridMatch(), { [A('Pusher')]: 'B2', [B('Swapper')]: 'B3' }, { constraint: tile('Water', 'Star'), turn: 5 }), ability(A('Pusher'), 'B3')],
    ['pull', construct(gridMatch(), { [B('Puller')]: 'A4', [B('Swapper')]: 'C4' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 4 }), ability(B('Puller'), 'C4')],
    ['swap', construct(gridMatch(), { [B('Swapper')]: 'B3', [A('Pusher')]: 'B4' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 4 }), ability(B('Swapper'), 'B4')],
  ];

  for (const [entry, position, action] of entries) {
    it(`triggers an enemy trap on entry by ${entry}`, () => {
      const { state, events } = applied(withTraps(position, ['A@B4', 'B@C4']), action);
      expect(triggers(events)).toEqual([expect.objectContaining({ owner: 'A', cell: 'B4' })]);
      expect(liveTraps(state)).toEqual(['B@C4']);
      expect(state.trapHistory.find((record) => record.cell === 'B4')?.fate).toMatchObject({ kind: 'triggered', turn: position.turn });
    });
  }

  it('lets own fighters enter and occupy own traps safely, without revealing or consuming them', () => {
    const position = withTraps(construct(gridMatch(), { [A('Pusher')]: 'B3' }, { constraint: tile('Water', 'Wave'), turn: 5 }), ['A@B4']);
    const { state, events } = applied(position, move(A('Pusher'), 'B4'));
    expect(triggers(events)).toEqual([]);
    expect(liveTraps(state)).toEqual(['A@B4']);
  });

  it('does not trigger on a fighter that stays while terrain is exchanged beneath it', () => {
    // Each fighter stands on its owner's trap; the other side's fighter could not stand on one
    // without having entered it.
    const position = withTraps(
      construct(gridMatch(), { [A('TerrainWeaver')]: 'B2', [B('Swapper')]: 'B3' }, { constraint: tile('Water', 'Sun'), turn: 5 }),
      ['B@B3', 'A@B2'],
    );
    const { state, events } = applied(position, ability(A('TerrainWeaver'), 'B3'));
    expect(triggers(events)).toEqual([]);
    expect(liveTraps(state)).toEqual(['B@B3', 'A@B2']);
  });

  it('does not trigger on the opening deployment when the preset says so', () => {
    const position = withTraps(gridMatch({}, presetWith({}, { trapsTriggerOnOpening: false })), ['B@A1']);
    const { state, events } = applied(position, deploy(A('Teleporter'), 'A1'));
    expect(triggers(events)).toEqual([]);
    expect(fighterOf(state, A('Teleporter')).charge).toBe(1);
    expect(liveTraps(state)).toEqual(['B@A1']);
    const live = withTraps(gridMatch(), ['B@A1']);
    expect(triggers(applied(live, deploy(A('Teleporter'), 'A1')).events)).toHaveLength(1);
  });
});

describe('trap effect and locks (spec §8.2)', () => {
  const walkIn = (charge: 0 | 1, active: 'A' | 'B' = 'A', turn = 5) =>
    withTraps(
      construct(gridMatch(), { [A('Pusher')]: 'B3', [B('Swapper')]: 'D3' }, { constraint: tile('Water', 'Wave'), turn, activePlayer: active }, { [A('Pusher')]: { charge } }),
      ['B@B4'],
    );

  it('finishes the position, reveals and removes the trap, then takes a charge of 1', () => {
    const { state, events } = applied(walkIn(1), move(A('Pusher'), 'B4'));
    expect(events.map((event) => event.kind)).toEqual(['fighter-entered', 'trap-triggered', 'charge-lost', 'constraint-set']);
    expect(fighterOf(state, A('Pusher'))).toMatchObject({ cell: 'B4', charge: 0, lock: null });
    expect(state.traps).toEqual([]);
  });

  it("locks a fighter with charge 0 until the end of its owner's turn after next when triggered on its owner's turn", () => {
    const { state, events } = applied(walkIn(0), move(A('Pusher'), 'B4'));
    expect(events).toContainEqual({ kind: 'lock-applied', fighter: A('Pusher'), expiresAfterTurn: 7 });
    // It misses exactly A's turn 7 and is free again on A's turn 9.
    const turn7 = play(state, move(B('Swapper'), 'D4'));
    expect(validateAction(turn7, move(A('Pusher'), 'B3'))).toEqual({ code: 'fighter-locked', fighter: A('Pusher') });
    const turn8 = play(turn7, deploy(A('Teleporter'), 'D1'));
    expect(fighterOf(turn8, A('Pusher')).lock).toBeNull();
  });

  it("covers the owner's upcoming turn when triggered on the opponent's turn", () => {
    const pulled = withTraps(
      construct(gridMatch(), { [B('Puller')]: 'A4', [A('Pusher')]: 'C4' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 6 }, { [A('Pusher')]: { charge: 0 } }),
      ['B@B4'],
    );
    const { state, events } = applied(pulled, ability(B('Puller'), 'C4'));
    expect(events).toContainEqual({ kind: 'lock-applied', fighter: A('Pusher'), expiresAfterTurn: 7 });
    expect(fighterOf(state, A('Pusher')).lock).toEqual({ expiresAfterTurn: 7 });
  });

  it('extends a reapplied lock to the later expiry rather than stacking', () => {
    const locked = withTraps(
      construct(
        gridMatch(),
        { [B('Puller')]: 'A4', [A('Pusher')]: 'C4' },
        { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 6 },
        { [A('Pusher')]: { charge: 0, lock: { expiresAfterTurn: 9 } } },
      ),
      ['B@B4'],
    );
    expect(applied(locked, ability(B('Puller'), 'C4')).events).toContainEqual({ kind: 'lock-applied', fighter: A('Pusher'), expiresAfterTurn: 9 });
    const shorter = construct(locked, {}, {}, { [A('Pusher')]: { lock: { expiresAfterTurn: 5 } } });
    expect(applied(shorter, ability(B('Puller'), 'C4')).events).toContainEqual({ kind: 'lock-applied', fighter: A('Pusher'), expiresAfterTurn: 7 });
  });

  it('stops a locked fighter from moving, activating or being recharged, by recharge or Upgrader', () => {
    const lock = { lock: { expiresAfterTurn: 9 } };
    const state = construct(
      gridMatch(),
      { [B('Swapper')]: 'B2', [B('Upgrader')]: 'B3', [B('Puller')]: 'C2' },
      { constraint: tile('Water', 'Moon'), activePlayer: 'B', turn: 8 },
      { [B('Swapper')]: { charge: 0, ...lock }, [B('Puller')]: { charge: 1, ...lock } },
    );
    expect(validateAction(state, move(B('Swapper'), 'A2'))?.code).toBe('fighter-locked');
    expect(validateAction(state, { kind: 'recharge', fighter: B('Swapper') })?.code).toBe('fighter-locked');
    expect(validateAction(state, ability(B('Puller'), 'A2'))?.code).toBe('fighter-locked');
    expect(validateAction(state, ability(B('Upgrader'), 'B2'))?.code).toBe('invalid-target');
    expect(listLegalActions(state).some((action) => action.fighter === B('Swapper') || action.fighter === B('Puller'))).toBe(false);
  });

  it('lets other fighters push, pull or swap a locked fighter', () => {
    const state = construct(
      gridMatch(),
      { [A('Pusher')]: 'B2', [B('Swapper')]: 'B3' },
      { constraint: tile('Water', 'Star'), turn: 7 },
      { [B('Swapper')]: { charge: 0, lock: { expiresAfterTurn: 8 } } },
    );
    const after = play(withTraps(state, []), ability(A('Pusher'), 'B3'));
    expect(fighterOf(after, B('Swapper'))).toMatchObject({ cell: 'B4', lock: { expiresAfterTurn: 8 } });
  });

  it('misses more owner turns when the preset says so', () => {
    const state = withTraps(construct(walkIn(0), {}, { preset: presetWith({}, { lockOwnTurnsMissed: 2 }) }), ['B@B4']);
    expect(applied(state, move(A('Pusher'), 'B4')).events).toContainEqual({ kind: 'lock-applied', fighter: A('Pusher'), expiresAfterTurn: 9 });
  });
});

describe('multiple traps and exchanges (spec §8.3)', () => {
  it('lets opposing traps overlap; each affects only the other side', () => {
    const position = withTraps(construct(gridMatch(), { [A('Pusher')]: 'B3' }, { constraint: tile('Water', 'Wave'), turn: 5 }), ['A@B4', 'B@B4']);
    const { state, events } = applied(position, move(A('Pusher'), 'B4'));
    expect(triggers(events)).toEqual([expect.objectContaining({ owner: 'B' })]);
    expect(liveTraps(state)).toEqual(['A@B4']);
  });

  it('resolves both entries of a swap after the exchange, then applies both effects before the objective check', () => {
    const position = withTraps(
      construct(
        gridMatch(),
        { [B('Swapper')]: 'B3', [A('Pusher')]: 'B4', [B('Upgrader')]: 'A3', [B('Puller')]: 'A4', [B('Trapper')]: 'D1' },
        { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 6 },
      ),
      ['A@B4', 'B@B3'],
    );
    const { events } = applied(position, ability(B('Swapper'), 'B4'));
    expect(events.map((event) => event.kind)).toEqual([
      'charge-spent',
      'fighter-entered',
      'fighter-entered',
      'trap-triggered',
      'lock-applied',
      'trap-triggered',
      'charge-lost',
      'constraint-set',
    ]);
  });

  it('allows at most the preset number of live traps per owner per cell', () => {
    const position = withTraps(
      construct(gridMatch(), { [B('Trapper')]: 'C2' }, { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 6 }),
      ['B@C1'],
    );
    expect(validateAction(position, ability(B('Trapper'), 'C1'))?.code).toBe('invalid-target');
    const two = { ...position, preset: presetWith({}, { liveTrapsPerOwnerPerCell: 2 }) };
    expect(liveTraps(play(two, ability(B('Trapper'), 'C1')))).toEqual(['B@C1', 'B@C1']);
  });
});
