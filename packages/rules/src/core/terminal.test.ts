import { describe, expect, it } from 'vitest';
import { applyAction, blockadeResult, listLegalActions, objectiveResult } from '../api';
import { A, B, construct, gridMatch, tile } from './testing';

const locked = { lock: { expiresAfterTurn: 100 } };

describe('Square objective (spec §10)', () => {
  it('wins when one side fills a 2×2 square', () => {
    const state = construct(
      gridMatch(),
      { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1', [B('Swapper')]: 'D4' },
      { constraint: tile('Forest', 'Moon'), turn: 7 },
    );
    expect(objectiveResult(state)).toBeNull();
    const applied = applyAction(state, { kind: 'deploy', fighter: A('TerrainWeaver'), cell: 'B2' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.state.result).toEqual({ kind: 'win', winner: 'A', reason: 'objective' });
    expect(applied.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'win', winner: 'A', reason: 'objective' } });
    expect(listLegalActions(applied.state)).toEqual([]);
    expect(applyAction(applied.state, { kind: 'move', fighter: B('Swapper'), cell: 'D3' })).toEqual({ ok: false, refusal: { code: 'match-over' } });
  });

  it('needs all four fighters of the side', () => {
    const three = construct(gridMatch(), { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1' });
    expect(objectiveResult(three)).toBeNull();
  });

  it('is a draw when both sides fill a square after one action', () => {
    const state = construct(gridMatch(), {
      [A('Teleporter')]: 'A1',
      [A('Pusher')]: 'A2',
      [A('TrapChecker')]: 'B1',
      [A('TerrainWeaver')]: 'B2',
      [B('Swapper')]: 'C3',
      [B('Upgrader')]: 'C4',
      [B('Puller')]: 'D3',
      [B('Trapper')]: 'D4',
    });
    expect(objectiveResult(state)).toEqual({ kind: 'draw', reason: 'simultaneous-objective' });
  });
});

describe('blockade (spec §11 steps 1–2, 10)', () => {
  const allALocked = construct(
    gridMatch(),
    { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A3', [A('TrapChecker')]: 'C1', [A('TerrainWeaver')]: 'C3' },
    { constraint: tile('Forest', 'Sun'), activePlayer: 'B', turn: 8 },
    { [A('Teleporter')]: locked, [A('Pusher')]: locked, [A('TrapChecker')]: locked, [A('TerrainWeaver')]: locked },
  );

  it('a player with no legal action loses', () => {
    const aToMove = { ...allALocked, activePlayer: 'A' as const };
    expect(listLegalActions(aToMove)).toEqual([]);
    expect(blockadeResult(aToMove)).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
  });

  it('ends the match when the hand-over leaves the next player without a legal action', () => {
    const applied = applyAction(allALocked, { kind: 'deploy', fighter: B('Swapper'), cell: 'A2' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.state.result).toEqual({ kind: 'win', winner: 'B', reason: 'blockade' });
    expect(applied.events.at(-1)).toEqual({ kind: 'match-ended', result: { kind: 'win', winner: 'B', reason: 'blockade' } });
  });
});
