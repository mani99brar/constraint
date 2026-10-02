import { describe, expect, it } from 'vitest';
import { applyAction, isEdgeCell, listLegalActions, validateAction, type Action } from '../api';
import { A, B, construct, gridMatch, tile } from './testing';

// GRID_BOARD: rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols (1 Sun, 2 Moon, 3 Star, 4 Wave).

describe('opening deployment (spec §5 step 7)', () => {
  it('must deploy onto an outside-edge cell, with no constraint', () => {
    const state = gridMatch();
    const legal = listLegalActions(state);
    expect(legal).toHaveLength(4 * 12);
    expect(legal.every((action) => action.kind === 'deploy' && isEdgeCell(action.cell))).toBe(true);
    expect(validateAction(state, { kind: 'deploy', fighter: A('Pusher'), cell: 'B2' })).toEqual({ code: 'not-edge-cell', cell: 'B2' });
  });

  it("sets the first constraint to the deployed tile's pair", () => {
    const applied = applyAction(gridMatch(), { kind: 'deploy', fighter: A('Pusher'), cell: 'C4' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.state.constraint).toEqual(tile('Mountain', 'Wave'));
    expect(applied.events).toContainEqual({ kind: 'constraint-set', constraint: tile('Mountain', 'Wave') });
    expect(applied.events[0]).toEqual({ kind: 'fighter-entered', fighter: A('Pusher'), from: null, to: 'C4', entry: 'deploy' });
    expect(applied.state.activePlayer).toBe('B');
    expect(applied.state.turn).toBe(2);
  });
});

describe('matching constraint (spec §6)', () => {
  const state = construct(gridMatch(), {}, { constraint: tile('Forest', 'Sun') });

  it('accepts a destination matching by terrain only', () => {
    expect(validateAction(state, { kind: 'deploy', fighter: A('Pusher'), cell: 'A3' })).toBeNull();
  });

  it('accepts a destination matching by symbol only', () => {
    expect(validateAction(state, { kind: 'deploy', fighter: A('Pusher'), cell: 'C1' })).toBeNull();
  });

  it('refuses a destination matching neither, without changing the state', () => {
    const before = JSON.parse(JSON.stringify(state)) as typeof state;
    const action: Action = { kind: 'deploy', fighter: A('Pusher'), cell: 'C3' };
    const applied = applyAction(state, action);
    expect(applied).toEqual({
      ok: false,
      refusal: { code: 'no-match', cell: 'C3', tile: tile('Mountain', 'Star'), constraint: tile('Forest', 'Sun') },
    });
    expect(state).toEqual(before);
    expect(listLegalActions(state)).not.toContainEqual(action);
  });
});

describe('normal movement (spec §7.2)', () => {
  const state = construct(gridMatch(), { [A('Pusher')]: 'B2' }, { constraint: tile('Forest', 'Moon') });

  it('is one orthogonal square onto an empty matching cell', () => {
    const moves = listLegalActions(state).filter((action) => action.kind === 'move');
    expect(moves).toEqual([
      { kind: 'move', fighter: A('Pusher'), cell: 'A2' },
      { kind: 'move', fighter: A('Pusher'), cell: 'C2' },
    ]);
    const applied = applyAction(state, moves[0]!);
    expect(applied.ok && applied.state.fighters.find((fighter) => fighter.id === A('Pusher'))?.cell).toBe('A2');
  });

  it('refuses a diagonal move even onto a matching cell', () => {
    expect(validateAction(state, { kind: 'move', fighter: A('Pusher'), cell: 'A1' })).toEqual({ code: 'not-adjacent', from: 'B2', to: 'A1' });
  });

  it('refuses a move of two squares', () => {
    expect(validateAction(state, { kind: 'move', fighter: A('Pusher'), cell: 'D2' })).toEqual({ code: 'not-adjacent', from: 'B2', to: 'D2' });
  });

  it("refuses moving the opponent's fighter", () => {
    const withEnemy = construct(state, { [B('Swapper')]: 'B3' });
    expect(validateAction(withEnemy, { kind: 'move', fighter: B('Swapper'), cell: 'A3' })).toEqual({
      code: 'not-your-fighter',
      fighter: B('Swapper'),
      activePlayer: 'A',
    });
  });
});
