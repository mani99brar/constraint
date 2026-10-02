import { describe, expect, it } from 'vitest';
import { applyAction, canonicalSignature, listLegalActions, playerView, validateAction, type Action, type CellId, type FighterId, type MatchState } from '../api';
import { A, applied, B, construct, fighterOf, gridMatch, play, presetWith, tile, withTraps } from './testing';

// GRID_BOARD: rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols
// (1 Sun, 2 Moon, 3 Star, 4 Wave), so a constraint matches its terrain's row and its symbol's column.

const move = (fighter: FighterId, cell: CellId): Action => ({ kind: 'move', fighter, cell });
const deploy = (fighter: FighterId, cell: CellId): Action => ({ kind: 'deploy', fighter, cell });
const recharge = (fighter: FighterId): Action => ({ kind: 'recharge', fighter });
const ability = (fighter: FighterId, target: CellId): Action => ({ kind: 'ability', fighter, target });
const locked = { lock: { expiresAfterTurn: 100 } };

describe('matching constraint (spec §6)', () => {
  it('stores the pair of values, not a cell: a kept constraint survives its tile being exchanged away', () => {
    const state = withTraps(
      construct(gridMatch(), { [B('Trapper')]: 'C4' }, { constraint: tile('Mountain', 'Moon'), activePlayer: 'B', turn: 6 }),
      [],
    );
    // C2 held Mountain–Moon when it set the constraint; its tile is now on D4.
    const exchanged = { ...state, board: { ...state.board, C2: state.board.D4, D4: state.board.C2 } };
    const after = play(exchanged, ability(B('Trapper'), 'C3'));
    expect(after.constraint).toEqual(tile('Mountain', 'Moon'));
    expect(after.board.C2).toEqual(tile('Desert', 'Wave'));
  });

  it('needs the action’s specified tile to match: the destination for a move, not the source', () => {
    const state = construct(gridMatch(), { [A('Pusher')]: 'D4' }, { constraint: tile('Forest', 'Wave'), turn: 5 });
    expect(validateAction(state, move(A('Pusher'), 'C4'))).toBeNull();
    expect(validateAction(state, move(A('Pusher'), 'D3'))?.code).toBe('no-match');
  });
});

describe('deploy (spec §7.1)', () => {
  it('places a reserve fighter on any empty matching cell, with no zone restriction after the opening', () => {
    const state = construct(gridMatch(), { [B('Swapper')]: 'A1' }, { constraint: tile('Water', 'Star'), turn: 3 });
    const cells = listLegalActions(state)
      .filter((action) => action.kind === 'deploy' && action.fighter === A('Pusher'))
      .map((action) => (action.kind === 'deploy' ? action.cell : null));
    expect(cells).toEqual(['A3', 'B1', 'B2', 'B3', 'B4', 'C3', 'D3']);
  });

  it('reveals its identity and charge, resolves the enemy trap there and sets the constraint', () => {
    const state = withTraps(construct(gridMatch(), {}, { constraint: tile('Water', 'Star'), turn: 3 }), ['B@B2']);
    const { state: after, events } = applied(state, deploy(A('Pusher'), 'B2'));
    expect(events.map((event) => event.kind)).toEqual(['fighter-entered', 'trap-triggered', 'charge-lost', 'constraint-set']);
    expect(playerView(after, 'B').fighters).toContainEqual(expect.objectContaining({ id: A('Pusher'), cell: 'B2', charge: 0 }));
    expect(after.constraint).toEqual(tile('Water', 'Moon'));
  });

  it('refuses a deployed fighter and an occupied cell', () => {
    const state = construct(gridMatch(), { [A('Pusher')]: 'B1', [B('Swapper')]: 'B2' }, { constraint: tile('Water', 'Star'), turn: 3 });
    expect(validateAction(state, deploy(A('Pusher'), 'B3'))?.code).toBe('not-in-reserve');
    expect(validateAction(state, deploy(A('Teleporter'), 'B2'))?.code).toBe('cell-occupied');
  });
});

describe('recharge (spec §7.3)', () => {
  const state = withTraps(
    construct(
      gridMatch(),
      { [A('Pusher')]: 'B2', [A('Teleporter')]: 'B3', [A('TrapChecker')]: 'D4' },
      { constraint: tile('Water', 'Wave'), turn: 5 },
      { [A('Pusher')]: { charge: 0 }, [A('TrapChecker')]: { charge: 0 } },
    ),
    [],
  );

  it("spends one shared recharge, restores charge 1 and sets the constraint to the fighter's tile", () => {
    const { state: after, events } = applied(state, recharge(A('Pusher')));
    expect(fighterOf(after, A('Pusher')).charge).toBe(1);
    expect(after.recharges).toEqual({ A: 2, B: 3 });
    expect(events).toEqual([
      { kind: 'recharge-spent', player: 'A', remaining: 2 },
      { kind: 'charge-restored', fighter: A('Pusher') },
      { kind: 'constraint-set', constraint: tile('Water', 'Moon') },
    ]);
    expect(fighterOf(after, A('Pusher')).cell).toBe('B2');
  });

  it('needs a deployed, unlocked fighter with charge 0 on a matching tile and a remaining recharge', () => {
    expect(validateAction(state, recharge(A('TrapChecker')))).toBeNull();
    expect(validateAction(state, recharge(A('TerrainWeaver')))?.code).toBe('not-deployed');
    expect(validateAction(state, recharge(A('Teleporter')))?.code).toBe('already-charged');
    expect(validateAction({ ...state, constraint: tile('Desert', 'Star') }, recharge(A('Pusher')))?.code).toBe('no-match');
    expect(validateAction(construct(state, {}, {}, { [A('Pusher')]: locked }), recharge(A('Pusher')))?.code).toBe('fighter-locked');
    expect(validateAction({ ...state, recharges: { A: 0, B: 3 } }, recharge(A('Pusher')))).toEqual({ code: 'no-recharges-left', player: 'A' });
  });

  it("is limited by the preset's recharge budget", () => {
    const match = gridMatch({}, presetWith({}, { rechargesPerPlayer: 1 }));
    expect(match.recharges).toEqual({ A: 1, B: 1 });
  });
});

describe('objective checks (spec §10)', () => {
  it("checks both players after every action: a forced move can complete the opponent's Square", () => {
    const state = withTraps(
      construct(
        gridMatch({ B: ['Pusher', 'Upgrader', 'Puller', 'Trapper'] }),
        { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1', [A('TerrainWeaver')]: 'B3', [B('Pusher')]: 'B4' },
        { constraint: tile('Water', 'Wave'), activePlayer: 'B', turn: 6 },
      ),
      [],
    );
    const { state: after, events } = applied(state, ability(B('Pusher'), 'B3'));
    expect(fighterOf(after, A('TerrainWeaver')).cell).toBe('B2');
    expect(after.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
    expect(events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'win', winner: 'A', reason: 'objective' } });
  });
});

describe('resolution and terminal ordering (spec §11)', () => {
  const blockadeAfterB = () =>
    withTraps(
      construct(
        gridMatch(),
        { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A3', [A('TrapChecker')]: 'C1', [A('TerrainWeaver')]: 'C3', [B('Swapper')]: 'D4' },
        { constraint: tile('Forest', 'Sun'), activePlayer: 'B', turn: 8 },
        { [A('Teleporter')]: locked, [A('Pusher')]: locked, [A('TrapChecker')]: locked, [A('TerrainWeaver')]: locked },
      ),
      [],
    );

  it('validates against the pre-action state and rejects without spending resources or advancing the turn', () => {
    const state = blockadeAfterB();
    const result = applyAction(state, ability(B('Swapper'), 'A1'));
    expect(result.ok).toBe(false);
    expect(state.turn).toBe(8);
    expect(state.activePlayer).toBe('B');
  });

  it('expires statuses scheduled for the end of this turn after the objective check, then hands over', () => {
    const state = withTraps(
      construct(
        gridMatch(),
        { [A('Pusher')]: 'B2', [B('Swapper')]: 'D4' },
        { constraint: tile('Water', 'Wave'), turn: 7 },
        { [A('Pusher')]: { charge: 0, lock: { expiresAfterTurn: 8 } }, [B('Swapper')]: { charge: 0, lock: { expiresAfterTurn: 7 } } },
      ),
      [],
    );
    const after = play(state, deploy(A('Teleporter'), 'B4'));
    expect(after.turn).toBe(8);
    expect(after.activePlayer).toBe('B');
    expect(fighterOf(after, B('Swapper')).lock).toBeNull();
    expect(fighterOf(after, A('Pusher')).lock).toEqual({ expiresAfterTurn: 8 });
  });

  it('ends the match with a blockade when the next player has no legal action; no skip or pass exists', () => {
    const after = play(blockadeAfterB(), deploy(B('Upgrader'), 'A2'));
    expect(after.result).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
  });

  it('puts the objective before the blockade', () => {
    const state = withTraps(
      construct(
        gridMatch(),
        { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'A3', [A('TerrainWeaver')]: 'A4', [B('Swapper')]: 'D4', [B('Upgrader')]: 'D3', [B('Puller')]: 'C4' },
        { constraint: tile('Forest', 'Star'), activePlayer: 'B', turn: 8 },
        { [A('Teleporter')]: locked, [A('Pusher')]: locked, [A('TrapChecker')]: locked, [A('TerrainWeaver')]: locked },
      ),
      [],
    );
    const after = play(state, deploy(B('Trapper'), 'C3'));
    expect(after.result).toEqual({ kind: 'win', winner: 'B', reason: 'objective' });
    expect(listLegalActions({ ...after, result: null, activePlayer: 'A' })).toEqual([]);
  });

  it('puts the blockade before the repetition draw', () => {
    const state = blockadeAfterB();
    const next = play(state, deploy(B('Upgrader'), 'A2'));
    const signature = canonicalSignature(next);
    const repeated = { ...state, repetition: [signature, signature] };
    expect(play(repeated, deploy(B('Upgrader'), 'A2')).result).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
  });

  it('puts the objective before the repetition draw', () => {
    const state = withTraps(
      construct(
        gridMatch(),
        { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1', [B('Swapper')]: 'D4' },
        { constraint: tile('Forest', 'Moon'), turn: 7 },
      ),
      [],
    );
    const won = play(state, deploy(A('TerrainWeaver'), 'B2'));
    expect(won.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
    const startOfNextTurn = canonicalSignature({ ...won, turn: won.turn + 1, activePlayer: 'B' });
    const repeated = { ...state, repetition: [startOfNextTurn, startOfNextTurn] };
    expect(play(repeated, deploy(A('TerrainWeaver'), 'B2')).result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
  });

  it('refuses an unknown action kind with a structured reason instead of treating it as legal', () => {
    const state = construct(gridMatch(), { [A('Pusher')]: 'B2' }, { constraint: tile('Water', 'Wave'), turn: 5 });
    const unknown = { kind: 'pass', fighter: A('Pusher'), cell: 'B3' } as unknown as Action;
    expect(validateAction(state, unknown)).toEqual({ code: 'unknown-action', kind: 'pass' });
    expect(applyAction(state, unknown)).toEqual({ ok: false, refusal: { code: 'unknown-action', kind: 'pass' } });
  });
});

describe('repetition draw (spec §12)', () => {
  // A's Pusher shuttles B1 ⇄ B2 and B's Swapper B4 ⇄ B3: every hop lands on Water, so each
  // matches the last, and the start-of-turn state recurs every four actions.
  const start = (): MatchState => {
    const state = withTraps(
      construct(gridMatch(), { [A('Pusher')]: 'B1', [B('Swapper')]: 'B4' }, { constraint: tile('Water', 'Wave'), turn: 9 }),
      ['A@A4', 'B@A1'],
    );
    return { ...state, repetition: [canonicalSignature(state)] };
  };
  const cycle = [move(A('Pusher'), 'B2'), move(B('Swapper'), 'B3'), move(A('Pusher'), 'B1'), move(B('Swapper'), 'B4')];

  it('draws on the third occurrence of the same full start-of-turn state, not necessarily consecutive', () => {
    const twice = play(start(), ...cycle);
    expect(twice.result).toBeNull();
    expect(twice.repetition.filter((signature) => signature === canonicalSignature(start()))).toHaveLength(2);
    const almost = play(twice, ...cycle.slice(0, 3));
    expect(almost.result).toBeNull();
    const { state: drawn, events } = applied(almost, cycle[3]!);
    expect(drawn.result).toEqual({ kind: 'draw', reason: 'repetition' });
    expect(events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'draw', reason: 'repetition' } });
  });

  it("draws at the preset's threshold", () => {
    const early = { ...start(), preset: presetWith({}, { repetitionThreshold: 2 }) };
    expect(play(early, ...cycle).result).toEqual({ kind: 'draw', reason: 'repetition' });
  });

  it('includes the active player, constraint, terrain, fighters and charges, recharges, live traps, statuses and objectives', () => {
    const base = start();
    const signature = canonicalSignature(base);
    const variants: MatchState[] = [
      { ...base, activePlayer: 'B' },
      { ...base, constraint: tile('Desert', 'Star') },
      { ...base, board: { ...base.board, A1: base.board.A2, A2: base.board.A1 } },
      construct(base, { [A('Pusher')]: 'C1' }),
      construct(base, {}, {}, { [A('Pusher')]: { charge: 0 } }),
      { ...base, recharges: { A: 2, B: 3 } },
      withTraps(base, ['A@A4']),
      construct(base, {}, {}, { [A('Pusher')]: { charge: 0, lock: { expiresAfterTurn: 10 } } }),
      construct(base, {}, {}, { [A('Pusher')]: { protection: { expiresAfterTurn: 10, by: A('Pusher') } } }),
      { ...base, objectives: { A: 'Square', B: 'Line' as 'Square' } },
    ];
    for (const variant of variants) expect(canonicalSignature(variant)).not.toBe(signature);
  });

  it('ignores the absolute turn, history and inspection memory, and counts statuses by remaining duration', () => {
    const base = construct(start(), {}, {}, { [A('Pusher')]: { charge: 0, lock: { expiresAfterTurn: 10 } } });
    const later = construct({ ...base, turn: 21, history: [], inspections: [{ turn: 3, inspector: 'A', actor: A('TrapChecker'), cell: 'C2', removedTrapIds: [] }] }, {}, {}, {
      [A('Pusher')]: { lock: { expiresAfterTurn: 22 } },
    });
    expect(canonicalSignature(later)).toBe(canonicalSignature(base));
  });
});
