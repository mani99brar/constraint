import { describe, expect, it } from 'vitest';
import { applyAction, hypotheticalState, listLegalActions, playerView, type MatchState } from '../api';
import { A, B, construct, gridMatch, play, tile, withTraps } from './testing';

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

  it('never mints a trap id that already exists, however many traps the view lacks', () => {
    // B's Trapper has placed traps on turns 4 and 6; A has two setup traps B never sees.
    let real: MatchState = withTraps(
      construct(gridMatch(), { [B('Trapper')]: 'C2', [A('Pusher')]: 'A4' }, { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 4 }),
      ['A@D4', 'A@D3', 'B@B1'],
    );
    real = play(real, { kind: 'ability', fighter: B('Trapper'), target: 'C1' }, { kind: 'move', fighter: A('Pusher'), cell: 'B4' });
    real = construct(real, {}, { constraint: tile('Mountain', 'Wave') }, { [B('Trapper')]: { charge: 1 } });
    real = play(real, { kind: 'ability', fighter: B('Trapper'), target: 'C3' }, { kind: 'move', fighter: A('Pusher'), cell: 'A4' });
    real = construct(real, {}, { constraint: tile('Mountain', 'Wave') }, { [B('Trapper')]: { charge: 1 } });
    let lookahead = hypotheticalState(playerView(real, 'B'));
    // A hand-made own trap named like the next mint, as an older engine or log could hold.
    lookahead = { ...lookahead, traps: [...lookahead.traps, { id: `B-trap-${lookahead.turn}`, owner: 'B', cell: 'D1' }] };
    lookahead = play(lookahead, { kind: 'ability', fighter: B('Trapper'), target: 'D2' });
    const ids = [...lookahead.traps.map((trap) => trap.id), ...lookahead.trapHistory.map((record) => record.id)];
    expect(new Set(lookahead.traps.map((trap) => trap.id)).size).toBe(lookahead.traps.length);
    expect(new Set(lookahead.trapHistory.map((record) => record.id)).size).toBe(lookahead.trapHistory.length);
    expect(ids.filter((id) => id === `B-trap-${real.turn}`)).toHaveLength(1);
    expect(lookahead.traps.map((trap) => trap.cell)).toEqual(['B1', 'C1', 'C3', 'D1', 'D2']);
  });
});
