import { describe, expect, it } from 'vitest';
import { applyAction, hypotheticalState, listLegalActions, playerView } from '../api';
import { A, construct, gridMatch, tile } from './testing';

describe('hypothetical state from a player view', () => {
  const state = construct(gridMatch(), { [A('Pusher')]: 'B2' }, { constraint: tile('Forest', 'Moon'), turn: 3 });

  it("is accepted by the legal-action listing and action application on the viewer's turn", () => {
    const hypothetical = hypotheticalState(playerView(state, 'A'));
    const legal = listLegalActions(hypothetical);
    expect(legal).toEqual(listLegalActions(state));
    const applied = applyAction(hypothetical, legal[0]!);
    expect(applied.ok).toBe(true);
  });

  it("fills the opponent's hidden reserve with placeholders it can act with", () => {
    const view = playerView(state, 'A');
    const hypothetical = hypotheticalState(view);
    expect(hypothetical.fighters.filter((fighter) => fighter.owner === 'B')).toHaveLength(4);
    expect(hypothetical.traps.every((trap) => trap.owner === 'A')).toBe(true);
    const opponentTurn = { ...hypothetical, activePlayer: 'B' as const };
    const legal = listLegalActions(opponentTurn);
    expect(legal.length).toBeGreaterThan(0);
    expect(applyAction(opponentTurn, legal[0]!).ok).toBe(true);
  });
});
