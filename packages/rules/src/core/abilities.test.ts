import { describe, expect, it } from 'vitest';
import { applyAction, listLegalActions, playerView, projectEvents, validateAction, type Action, type CellId, type FighterId } from '../api';
import { A, applied, B, construct, fighterOf, gridMatch, liveTraps, play, tile, withTraps } from './testing';

// GRID_BOARD: rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols
// (1 Sun, 2 Moon, 3 Star, 4 Wave), so a constraint matches its terrain's row and its symbol's column.

const ability = (fighter: FighterId, target: CellId): Action => ({ kind: 'ability', fighter, target });
const targetsOf = (state: Parameters<typeof listLegalActions>[0], fighter: FighterId) =>
  listLegalActions(state)
    .filter((action) => action.kind === 'ability' && action.fighter === fighter)
    .map((action) => (action.kind === 'ability' ? action.target : null))
    .sort();

const ANCHOR_ROSTER = { A: ['Anchor', 'Pusher', 'TrapChecker', 'Teleporter'] as const };

describe('Teleporter (spec §9)', () => {
  const state = withTraps(construct(gridMatch(), { [A('Teleporter')]: 'A1', [B('Swapper')]: 'B1' }, { constraint: tile('Forest', 'Sun'), turn: 5 }), []);

  it('targets every empty matching cell other than its own', () => {
    expect(targetsOf(state, A('Teleporter'))).toEqual(['A2', 'A3', 'A4', 'C1', 'D1']);
  });

  it('moves directly there, and the destination tile becomes the constraint', () => {
    const { state: after, events } = applied(state, ability(A('Teleporter'), 'D1'));
    expect(fighterOf(after, A('Teleporter'))).toMatchObject({ cell: 'D1', charge: 0 });
    expect(events).toContainEqual({ kind: 'fighter-entered', fighter: A('Teleporter'), from: 'A1', to: 'D1', entry: 'teleport' });
    expect(after.constraint).toEqual(tile('Desert', 'Sun'));
  });

  it('does not enter or check the cells in between', () => {
    const trapped = withTraps(state, ['B@B1', 'B@C1']);
    const { events } = applied(trapped, ability(A('Teleporter'), 'D1'));
    expect(events.some((event) => event.kind === 'trap-triggered')).toBe(false);
  });
});

describe('Pusher (spec §9)', () => {
  const base = withTraps(construct(gridMatch(), { [A('Pusher')]: 'B2', [B('Swapper')]: 'B3', [A('Teleporter')]: 'C2' }, { constraint: tile('Water', 'Sun'), turn: 5 }), []);

  it('targets an adjacent matching fighter, ally or enemy, with an empty in-bounds cell beyond', () => {
    expect(targetsOf(base, A('Pusher'))).toEqual(['B3']);
    const columnTwo = { ...base, constraint: tile('Desert', 'Moon') };
    expect(targetsOf(columnTwo, A('Pusher'))).toEqual(['C2']);
  });

  it('moves the target one cell directly away; the actor stays and the destination sets the constraint', () => {
    const { state: after, events } = applied(base, ability(A('Pusher'), 'B3'));
    expect(fighterOf(after, B('Swapper')).cell).toBe('B4');
    expect(fighterOf(after, A('Pusher')).cell).toBe('B2');
    expect(events).toContainEqual({ kind: 'fighter-entered', fighter: B('Swapper'), from: 'B3', to: 'B4', entry: 'push' });
    expect(after.constraint).toEqual(tile('Water', 'Wave'));
  });

  it('cannot push off the board or into an occupied cell', () => {
    const edge = construct(base, { [B('Swapper')]: 'B4', [A('Pusher')]: 'B3' });
    expect(validateAction(edge, ability(A('Pusher'), 'B4'))).toEqual({ code: 'invalid-target', fighter: A('Pusher'), target: 'B4' });
    const blocked = construct(base, { [B('Upgrader')]: 'B4' });
    expect(validateAction(blocked, ability(A('Pusher'), 'B3'))?.code).toBe('invalid-target');
  });

  it('cannot target a fighter on a non-matching tile or an empty cell', () => {
    const elsewhere = { ...base, constraint: tile('Desert', 'Wave') };
    expect(targetsOf(elsewhere, A('Pusher'))).toEqual([]);
    expect(validateAction(base, ability(A('Pusher'), 'A2'))?.code).toBe('invalid-target');
  });
});

describe('Swapper (spec §9)', () => {
  const state = withTraps(
    construct(gridMatch(), { [B('Swapper')]: 'B2', [A('Pusher')]: 'B3', [B('Puller')]: 'C2' }, { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 6 }),
    [],
  );

  it('targets an adjacent fighter, ally or enemy, on a matching tile', () => {
    expect(targetsOf(state, B('Swapper'))).toEqual(['B3']);
    expect(targetsOf({ ...state, constraint: tile('Mountain', 'Star') }, B('Swapper'))).toEqual(['B3', 'C2']);
  });

  it("exchanges both positions; the actor's destination sets the constraint", () => {
    const { state: after, events } = applied(state, ability(B('Swapper'), 'B3'));
    expect(fighterOf(after, B('Swapper')).cell).toBe('B3');
    expect(fighterOf(after, A('Pusher')).cell).toBe('B2');
    expect(events.filter((event) => event.kind === 'fighter-entered').map((event) => event.kind === 'fighter-entered' && event.entry)).toEqual(['swap', 'swap']);
    expect(after.constraint).toEqual(tile('Water', 'Star'));
  });
});

describe('Upgrader (spec §9)', () => {
  const state = withTraps(
    construct(
      gridMatch(),
      { [B('Upgrader')]: 'C2', [B('Swapper')]: 'C3', [B('Puller')]: 'B2', [B('Trapper')]: 'D2', [A('Pusher')]: 'C1' },
      { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 6 },
      {
        [B('Swapper')]: { charge: 0 },
        [B('Puller')]: { charge: 0, lock: { expiresAfterTurn: 7 } },
        [A('Pusher')]: { charge: 0 },
      },
    ),
    [],
  );

  it('targets an adjacent unlocked ally with charge 0, never itself, a charged, locked or enemy fighter', () => {
    expect(targetsOf(state, B('Upgrader'))).toEqual(['C3']);
  });

  it("transfers its charge without spending a shared recharge; the actor's tile sets the constraint", () => {
    const { state: after, events } = applied(state, ability(B('Upgrader'), 'C3'));
    expect(fighterOf(after, B('Upgrader')).charge).toBe(0);
    expect(fighterOf(after, B('Swapper')).charge).toBe(1);
    expect(after.recharges).toEqual(state.recharges);
    expect(events.map((event) => event.kind)).toEqual(['charge-spent', 'charge-restored', 'constraint-set']);
    expect(after.constraint).toEqual(tile('Mountain', 'Moon'));
  });

  it("needs the actor's own tile to match", () => {
    expect(targetsOf({ ...state, constraint: tile('Desert', 'Star') }, B('Upgrader'))).toEqual([]);
  });
});

describe('Trap Checker (spec v0.2 §9)', () => {
  const state = withTraps(
    construct(gridMatch(), { [A('TrapChecker')]: 'C2', [A('Pusher')]: 'C3', [B('Swapper')]: 'B2' }, { constraint: tile('Mountain', 'Wave'), turn: 5 }),
    ['B@C1', 'A@C1', 'B@D2'],
  );

  it("targets one adjacent cell that is empty or enemy-occupied, never an ally's", () => {
    expect(targetsOf(state, A('TrapChecker'))).toEqual(['B2', 'C1', 'D2']);
  });

  it('offers the same targets whether or not enemy traps are there, so legality reveals no trap', () => {
    expect(targetsOf(withTraps(state, []), A('TrapChecker'))).toEqual(targetsOf(state, A('TrapChecker')));
  });

  it("removes the enemy traps in the chosen cell only, keeps friendly traps, and sets the actor's tile", () => {
    const { state: after, events } = applied(state, ability(A('TrapChecker'), 'C1'));
    expect(liveTraps(after)).toEqual(['A@C1', 'B@D2']);
    expect(events).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'C1', removed: 1 });
    expect(after.trapHistory.find((record) => record.owner === 'B' && record.cell === 'C1')?.fate).toEqual({ kind: 'removed', turn: 5, by: A('TrapChecker') });
    expect(after.constraint).toEqual(tile('Mountain', 'Moon'));
  });

  it('is legal with nothing found, still spending its charge', () => {
    const { state: after, events } = applied(state, ability(A('TrapChecker'), 'B2'));
    expect(fighterOf(after, A('TrapChecker')).charge).toBe(0);
    expect(events).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'B2', removed: 0 });
  });

  it("shows its result only in its owner's view; the other side still sees its trap", () => {
    const { state: after, events } = applied(state, ability(A('TrapChecker'), 'C1'));
    expect(playerView(after, 'A').inspections).toEqual([{ turn: 5, inspector: 'A', actor: A('TrapChecker'), cell: 'C1', removedTrapIds: ['B-setup-1'] }]);
    expect(playerView(after, 'B').inspections).toEqual([]);
    expect(projectEvents(events, 'B')).toContainEqual({ kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'C1', removed: null });
    expect(playerView(after, 'B').ownTraps.map((trap) => trap.cell)).toEqual(['C1', 'D2']);
  });
});

describe('Puller (spec §9)', () => {
  const state = withTraps(
    construct(
      gridMatch(),
      { [B('Puller')]: 'A1', [A('Pusher')]: 'C1', [B('Swapper')]: 'A3', [A('Teleporter')]: 'A4' },
      { constraint: tile('Mountain', 'Star'), activePlayer: 'B', turn: 6 },
    ),
    [],
  );

  it('targets a fighter exactly two cells away in a row or column, on a matching tile, across an empty cell', () => {
    expect(targetsOf(state, B('Puller'))).toEqual(['A3', 'C1']);
  });

  it("moves the target into the cell between; the actor stays and that cell's tile sets the constraint", () => {
    const { state: after, events } = applied(state, ability(B('Puller'), 'C1'));
    expect(fighterOf(after, A('Pusher')).cell).toBe('B1');
    expect(fighterOf(after, B('Puller')).cell).toBe('A1');
    expect(events).toContainEqual({ kind: 'fighter-entered', fighter: A('Pusher'), from: 'C1', to: 'B1', entry: 'pull' });
    expect(after.constraint).toEqual(tile('Water', 'Sun'));
  });

  it('needs the intervening cell empty', () => {
    const blocked = construct(state, { [B('Trapper')]: 'B1' });
    expect(targetsOf(blocked, B('Puller'))).toEqual(['A3']);
  });

  it('does not reach one or three cells away', () => {
    const near = construct(state, { [A('Pusher')]: 'B1', [B('Swapper')]: null }, { constraint: tile('Water', 'Wave') });
    expect(targetsOf(near, B('Puller'))).toEqual([]);
    expect(validateAction(state, ability(B('Puller'), 'A4'))?.code).toBe('invalid-target');
  });
});

describe('Anchor (spec §9)', () => {
  const state = withTraps(
    construct(
      gridMatch(ANCHOR_ROSTER),
      { [A('Anchor')]: 'B2', [A('Pusher')]: 'B3', [A('TrapChecker')]: 'D4', [B('Swapper')]: 'C2' },
      { constraint: tile('Water', 'Wave'), turn: 5 },
    ),
    [],
  );

  it('targets itself or an adjacent ally, never an enemy, with its own tile matching', () => {
    expect(targetsOf(state, A('Anchor'))).toEqual(['B2', 'B3']);
    expect(targetsOf({ ...state, constraint: tile('Desert', 'Wave') }, A('Anchor'))).toEqual([]);
  });

  it("protects through the end of the opponent's next turn; the actor's tile sets the constraint", () => {
    const { state: after, events } = applied(state, ability(A('Anchor'), 'B3'));
    expect(fighterOf(after, A('Pusher')).protection).toEqual({ expiresAfterTurn: 6, by: A('Anchor') });
    expect(events).toContainEqual({ kind: 'protection-applied', fighter: A('Pusher'), expiresAfterTurn: 6 });
    expect(after.constraint).toEqual(tile('Water', 'Moon'));
  });

  it('blocks enemy-forced push, pull and swap but not friendly displacement', () => {
    const protectedPusher = { expiresAfterTurn: 9, by: A('Anchor') };
    const enemyTurn = withTraps(
      construct(
        gridMatch(ANCHOR_ROSTER),
        { [A('Pusher')]: 'B2', [B('Swapper')]: 'B3', [B('Puller')]: 'D2', [A('Anchor')]: 'B1' },
        { constraint: tile('Water', 'Moon'), activePlayer: 'B', turn: 8 },
        { [A('Pusher')]: { protection: protectedPusher } },
      ),
      [],
    );
    expect(targetsOf(enemyTurn, B('Swapper'))).toEqual([]);
    expect(targetsOf(enemyTurn, B('Puller'))).toEqual([]);
    const unprotected = construct(enemyTurn, {}, {}, { [A('Pusher')]: { protection: null } });
    expect(targetsOf(unprotected, B('Swapper'))).toEqual(['B2']);
    expect(targetsOf(unprotected, B('Puller'))).toEqual(['B2']);
    // A's own Pusher may still push it, and it may still move itself.
    const ownTurn = construct(enemyTurn, { [A('TrapChecker')]: 'C2', [B('Puller')]: null }, { activePlayer: 'A', turn: 9 });
    const shieldedAlly = construct(ownTurn, {}, {}, { [A('TrapChecker')]: { protection: protectedPusher } });
    expect(validateAction(shieldedAlly, ability(A('Pusher'), 'C2'))).toBeNull();
    expect(validateAction(ownTurn, { kind: 'move', fighter: A('Pusher'), cell: 'A2' })).toBeNull();
  });

  it('cannot select an already protected target', () => {
    const shielded = construct(state, {}, {}, { [A('Pusher')]: { protection: { expiresAfterTurn: 6, by: A('Anchor') } } });
    expect(targetsOf(shielded, A('Anchor'))).toEqual(['B2']);
  });

  it('protection follows the fighter and is not removed by a lock', () => {
    const after = play(state, ability(A('Anchor'), 'B3'));
    const moved = construct(after, { [A('Pusher')]: 'C3' }, {}, { [A('Pusher')]: { lock: { expiresAfterTurn: 8 } } });
    expect(fighterOf(moved, A('Pusher')).protection).toEqual({ expiresAfterTurn: 6, by: A('Anchor') });
  });
});

describe('Terrain Weaver (spec §9)', () => {
  const state = withTraps(
    construct(gridMatch(), { [A('TerrainWeaver')]: 'B2', [B('Swapper')]: 'B3' }, { constraint: tile('Water', 'Sun'), turn: 5 }),
    ['B@B3', 'A@B2'],
  );

  it('targets any adjacent cell, occupied or empty, with its own tile matching', () => {
    expect(targetsOf(state, A('TerrainWeaver'))).toEqual(['A2', 'B1', 'B3', 'C2']);
    expect(targetsOf({ ...state, constraint: tile('Desert', 'Star') }, A('TerrainWeaver'))).toEqual([]);
  });

  it('exchanges the two tiles only; fighters and traps stay, nothing triggers, and the new tile beneath it sets the constraint', () => {
    const { state: after, events } = applied(state, ability(A('TerrainWeaver'), 'B3'));
    expect(after.board.B2).toEqual(tile('Water', 'Star'));
    expect(after.board.B3).toEqual(tile('Water', 'Moon'));
    expect(fighterOf(after, B('Swapper')).cell).toBe('B3');
    expect(liveTraps(after)).toEqual(['B@B3', 'A@B2']);
    expect(events.map((event) => event.kind)).toEqual(['charge-spent', 'terrain-exchanged', 'constraint-set']);
    expect(after.constraint).toEqual(tile('Water', 'Star'));
  });
});

describe('Trapper (spec §9)', () => {
  const state = withTraps(
    construct(
      gridMatch(),
      { [B('Trapper')]: 'C2', [B('Swapper')]: 'C3', [A('Pusher')]: 'B2' },
      { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 6 },
    ),
    ['B@C1', 'A@D2'],
  );

  it('targets an adjacent cell that is empty or holds an ally, never an enemy or a cell with its own trap', () => {
    expect(targetsOf(state, B('Trapper'))).toEqual(['C3', 'D2']);
  });

  it('places a secret trap, keeps the constraint and needs only the actor to match', () => {
    const { state: after, events } = applied(state, ability(B('Trapper'), 'D2'));
    expect(liveTraps(after)).toEqual(['B@C1', 'A@D2', 'B@D2']);
    expect(after.constraint).toEqual(tile('Mountain', 'Wave'));
    expect(events.map((event) => event.kind)).toEqual(['charge-spent', 'trap-placed']);
    expect(after.trapHistory.at(-1)).toMatchObject({ owner: 'B', cell: 'D2', source: 'trapper', placedOnTurn: 6, placedBy: B('Trapper') });
    expect(playerView(after, 'A').log.at(-1)?.action).toEqual({ kind: 'ability', fighter: B('Trapper'), target: null });
    expect(JSON.stringify(playerView(after, 'A').log.at(-1))).not.toContain('D2');
  });

  it('places beneath an ally without triggering; the trap stays dormant until an enemy enters', () => {
    const placed = play(state, ability(B('Trapper'), 'C3'));
    expect(liveTraps(placed)).toContain('B@C3');
    const vacated = construct(placed, { [B('Swapper')]: 'C4', [A('Pusher')]: 'B3' }, { activePlayer: 'A', constraint: tile('Water', 'Star') });
    const { events } = applied(vacated, { kind: 'move', fighter: A('Pusher'), cell: 'C3' });
    expect(events).toContainEqual(expect.objectContaining({ kind: 'trap-triggered', owner: 'B', cell: 'C3', fighter: A('Pusher') }));
  });
});

describe('ability activation (spec §7.4, §9)', () => {
  const state = withTraps(construct(gridMatch(), { [A('Teleporter')]: 'A1', [B('Swapper')]: 'A2' }, { constraint: tile('Forest', 'Sun'), turn: 5 }), []);

  it("cannot activate the opponent's fighter", () => {
    expect(validateAction(state, ability(B('Swapper'), 'A1'))).toEqual({ code: 'not-your-fighter', fighter: B('Swapper'), activePlayer: 'A' });
  });

  it('needs a deployed, unlocked fighter with charge 1, and refuses without spending anything', () => {
    expect(validateAction(state, ability(A('Pusher'), 'A3'))).toEqual({ code: 'not-deployed', fighter: A('Pusher') });
    const spent = construct(state, {}, {}, { [A('Teleporter')]: { charge: 0 } });
    expect(validateAction(spent, ability(A('Teleporter'), 'A3'))).toEqual({ code: 'no-charge', fighter: A('Teleporter') });
    const locked = construct(state, {}, {}, { [A('Teleporter')]: { charge: 0, lock: { expiresAfterTurn: 5 } } });
    expect(validateAction(locked, ability(A('Teleporter'), 'A3'))).toEqual({ code: 'fighter-locked', fighter: A('Teleporter') });
    expect(applyAction(state, ability(A('Teleporter'), 'A2'))).toEqual({ ok: false, refusal: { code: 'invalid-target', fighter: A('Teleporter'), target: 'A2' } });
  });

  it('spends the charge before applying the effects', () => {
    const { events } = applied(state, ability(A('Teleporter'), 'C1'));
    expect(events[0]).toEqual({ kind: 'charge-spent', fighter: A('Teleporter') });
  });
});
