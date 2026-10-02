import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { ALL_CELLS, applyAction, listLegalActions, playerView, type Action, type CellId, type FighterState } from '@okiya/rules';
import { Board } from './Board';
import { createMatch, HUMAN, prepare } from './match';
import { glowingCells, pieceButtons, playableFighters, resolveCellTap, SELECT_FIRST } from './pieceActions';
import { defaultHumanSetup } from './setup';
import { describeRefusal } from './text';

// Hand-built legal-action list for several fighters.
const LEGAL: readonly Action[] = [
  { kind: 'move', fighter: 'A:Pusher', cell: 'B2' },
  { kind: 'move', fighter: 'A:Pusher', cell: 'C3' },
  { kind: 'ability', fighter: 'A:Pusher', target: 'B4' },
  { kind: 'ability', fighter: 'A:Pusher', target: 'C3' },
  { kind: 'recharge', fighter: 'A:Teleporter' },
  { kind: 'move', fighter: 'A:Teleporter', cell: 'D3' },
  { kind: 'deploy', fighter: 'A:Anchor', cell: 'A1' },
  { kind: 'deploy', fighter: 'A:Anchor', cell: 'D4' },
];

const pusher: FighterState = { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B3', charge: 1, lock: null, protection: null };
const teleporter: FighterState = { id: 'A:Teleporter', owner: 'A', type: 'Teleporter', cell: 'C3', charge: 0, lock: null, protection: null };
const anchor: FighterState = { id: 'A:Anchor', owner: 'A', type: 'Anchor', cell: null, charge: 1, lock: null, protection: null };
const swapper: FighterState = { id: 'B:Swapper', owner: 'B', type: 'Swapper', cell: 'A4', charge: 1, lock: null, protection: null };
const sorted = (cells: Iterable<CellId>) => [...cells].sort();

describe('on-token buttons (PRD T3)', () => {
  it('are exactly the selected fighter’s legal ability and recharge actions', () => {
    const buttons = pieceButtons(LEGAL, pusher);
    expect(buttons.map((button) => [button.kind, button.text])).toEqual([['ability', 'Push']]);
    expect(buttons[0]!.actions).toEqual([LEGAL[2], LEGAL[3]]);
    const recharge = pieceButtons(LEGAL, teleporter);
    expect(recharge.map((button) => [button.kind, button.label])).toEqual([['recharge', 'Recharge Teleporter']]);
    expect(recharge[0]!.actions).toEqual([LEGAL[4]]);
    expect(pieceButtons(LEGAL, anchor)).toEqual([]);
    expect(pieceButtons(LEGAL, null)).toEqual([]);
  });

  it('make exactly the legal move cells glow, then the ability targets once the ability is chosen', () => {
    expect(sorted(glowingCells(LEGAL, { fighter: pusher, mode: 'move' }))).toEqual(['B2', 'C3']);
    expect(sorted(glowingCells(LEGAL, { fighter: pusher, mode: 'ability' }))).toEqual(['B4', 'C3']);
    expect(sorted(glowingCells(LEGAL, { fighter: anchor, mode: 'move' }))).toEqual(['A1', 'D4']);
    expect(sorted(glowingCells(LEGAL, { fighter: teleporter, mode: 'move' }))).toEqual(['D3']);
    expect(glowingCells(LEGAL, null).size).toBe(0);
  });

  it('light nothing with highlights off', () => {
    expect(glowingCells(LEGAL, { fighter: pusher, mode: 'move' }, false).size).toBe(0);
    expect(playableFighters(LEGAL, false).size).toBe(0);
    expect([...playableFighters(LEGAL)].sort()).toEqual(['A:Anchor', 'A:Pusher', 'A:Teleporter']);
  });
});

describe('cell taps', () => {
  const tap = (cell: CellId, selection: Parameters<typeof resolveCellTap>[0]['selection'], occupant?: FighterState) =>
    resolveCellTap({ cell, human: 'A', selection, legalActions: LEGAL, occupant });

  it('applies the legal action of the current mode on a glowing cell', () => {
    expect(tap('C3', { fighter: pusher, mode: 'move' })).toEqual({ kind: 'apply', action: LEGAL[1] });
    expect(tap('C3', { fighter: pusher, mode: 'ability' })).toEqual({ kind: 'apply', action: LEGAL[3] });
    expect(tap('D4', { fighter: anchor, mode: 'move' })).toEqual({ kind: 'apply', action: LEGAL[7] });
  });

  it('selects an own token, cancels on the selected token, and asks for a token first', () => {
    expect(tap('C3', null, teleporter)).toEqual({ kind: 'select', fighter: 'A:Teleporter' });
    expect(tap('B3', { fighter: pusher, mode: 'move' }, pusher)).toEqual({ kind: 'cancel' });
    expect(tap('D1', null)).toEqual({ kind: 'hint', message: SELECT_FIRST });
    expect(tap('A4', null, swapper)).toEqual({ kind: 'hint', message: SELECT_FIRST });
  });

  it('attempts the plain action elsewhere, so the engine gives the refusal', () => {
    expect(tap('D1', { fighter: anchor, mode: 'move' })).toEqual({ kind: 'attempt', action: { kind: 'deploy', fighter: 'A:Anchor', cell: 'D1' } });
    expect(tap('A4', { fighter: pusher, mode: 'move' }, swapper)).toEqual({ kind: 'attempt', action: { kind: 'move', fighter: 'A:Pusher', cell: 'A4' } });
    expect(tap('D1', { fighter: pusher, mode: 'ability' })).toEqual({ kind: 'attempt', action: { kind: 'ability', fighter: 'A:Pusher', target: 'D1' } });
  });
});

describe('highlights setting on the board (PRD E4)', () => {
  const state = createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3);
  const view = playerView(state, HUMAN);
  const legal = listLegalActions(state);
  const fighter = view.fighters.find((candidate) => candidate.id === legal[0]!.fighter)!;
  const selection = { fighter, mode: 'move' } as const;

  const boardHtml = (highlights: boolean) =>
    renderToStaticMarkup(
      createElement(Board, {
        testId: 'board',
        board: view.board,
        human: HUMAN,
        fighters: view.fighters,
        ownTraps: new Set<CellId>(),
        glowing: glowingCells(legal, selection, highlights),
        onCellClick: () => {},
      }),
    );

  it('glows exactly the legal cells with highlights on, and none with them off', () => {
    const legalCells = new Set(legal.filter((action) => action.fighter === fighter.id && action.kind === 'deploy').map((action) => (action as { cell: CellId }).cell));
    expect(legalCells.size).toBeGreaterThan(0);
    const glowing = [...boardHtml(true).matchAll(/data-cell="([A-D][1-4])"[^>]*data-glow="true"/g)].map((match) => match[1]);
    expect(sorted(glowing as CellId[])).toEqual(sorted(legalCells));
    expect(boardHtml(false)).not.toContain('data-glow="true"');
  });

  it('leaves legal taps and refusal reasons unchanged with highlights off', () => {
    const legalCell = (legal[0] as { cell: CellId }).cell;
    expect(resolveCellTap({ cell: legalCell, human: HUMAN, selection, legalActions: legal, occupant: undefined })).toEqual({ kind: 'apply', action: legal[0] });
    const illegal = ALL_CELLS.find((cell) => !legal.some((action) => action.fighter === fighter.id && 'cell' in action && action.cell === cell))!;
    const attempt = resolveCellTap({ cell: illegal, human: HUMAN, selection, legalActions: legal, occupant: undefined });
    expect(attempt.kind).toBe('attempt');
    if (attempt.kind !== 'attempt') return;
    const refused = applyAction(state, attempt.action);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(describeRefusal(refused.refusal)).toBe(`${illegal} is not on the outside edge; the opening deployment must be.`);
  });
});
