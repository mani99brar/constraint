import { describe, expect, it } from 'vitest';
import type { Action, FighterState } from '@okiya/rules';
import { highlightedCells, optionsFor, resolveCellClick } from './selection';

// Hand-built: the worktree's engine offers no ability targets yet (PRD R3).
const LEGAL: readonly Action[] = [
  { kind: 'move', fighter: 'A:Pusher', cell: 'B2' },
  { kind: 'move', fighter: 'A:Pusher', cell: 'C3' },
  { kind: 'ability', fighter: 'A:Pusher', target: 'B4' },
  { kind: 'ability', fighter: 'A:Pusher', target: 'C3' },
  { kind: 'recharge', fighter: 'A:Teleporter' },
  { kind: 'ability', fighter: 'A:Teleporter', target: 'D1' },
  { kind: 'deploy', fighter: 'A:Anchor', cell: 'A1' },
  { kind: 'deploy', fighter: 'A:Anchor', cell: 'D4' },
  { kind: 'deploy', fighter: 'A:TrapChecker', cell: 'A1' },
];

const pusher: FighterState = { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B3', charge: 1, lock: null, protection: null };
const anchor: FighterState = { id: 'A:Anchor', owner: 'A', type: 'Anchor', cell: null, charge: 1, lock: null, protection: null };
const teleporter: FighterState = { id: 'A:Teleporter', owner: 'A', type: 'Teleporter', cell: 'C3', charge: 0, lock: null, protection: null };

describe('selection (PRD R3)', () => {
  it('yields a deployed fighter’s move destinations and ability targets, one entry per action', () => {
    const options = optionsFor(LEGAL, 'A:Pusher');
    expect(options).toEqual([
      { action: LEGAL[0], cell: 'B2' },
      { action: LEGAL[1], cell: 'C3' },
      { action: LEGAL[2], cell: 'B4' },
      { action: LEGAL[3], cell: 'C3' },
    ]);
    const cells = highlightedCells(options);
    expect([...cells.keys()].sort()).toEqual(['B2', 'B4', 'C3']);
    expect(cells.get('C3')?.map((option) => option.action.kind)).toEqual(['move', 'ability']);
  });

  it('yields a reserve fighter’s legal deployment cells', () => {
    const options = optionsFor(LEGAL, 'A:Anchor');
    expect(options.map((option) => option.action.kind)).toEqual(['deploy', 'deploy']);
    expect([...highlightedCells(options).keys()]).toEqual(['A1', 'D4']);
  });

  it('offers recharge as an option without a cell', () => {
    const options = optionsFor(LEGAL, 'A:Teleporter');
    expect(options).toEqual([
      { action: LEGAL[4], cell: null },
      { action: LEGAL[5], cell: 'D1' },
    ]);
    expect([...highlightedCells(options).keys()]).toEqual(['D1']);
  });

  it('has no options without a selection', () => {
    expect(optionsFor(LEGAL, null)).toEqual([]);
  });
});

describe('cell clicks', () => {
  const options = optionsFor(LEGAL, 'A:Pusher');

  it('applies the single legal action on a cell', () => {
    expect(resolveCellClick({ cell: 'B4', human: 'A', selection: pusher, options, occupant: undefined })).toEqual({
      kind: 'apply',
      action: LEGAL[2],
    });
  });

  it('asks which action is meant when a cell carries several', () => {
    const click = resolveCellClick({ cell: 'C3', human: 'A', selection: pusher, options, occupant: teleporter });
    expect(click).toEqual({
      kind: 'choose',
      cell: 'C3',
      choices: [
        { kind: 'action', action: LEGAL[1] },
        { kind: 'action', action: LEGAL[3] },
        { kind: 'select', fighter: 'A:Teleporter' },
      ],
    });
  });

  it('selects another own fighter on a cell without options', () => {
    expect(resolveCellClick({ cell: 'C3', human: 'A', selection: anchor, options: [], occupant: teleporter })).toEqual({
      kind: 'select',
      fighter: 'A:Teleporter',
    });
  });

  it('attempts the plain deploy or move elsewhere, so the engine gives the refusal', () => {
    expect(resolveCellClick({ cell: 'B1', human: 'A', selection: anchor, options: optionsFor(LEGAL, 'A:Anchor'), occupant: undefined })).toEqual({
      kind: 'attempt',
      action: { kind: 'deploy', fighter: 'A:Anchor', cell: 'B1' },
    });
    expect(resolveCellClick({ cell: 'D4', human: 'A', selection: pusher, options, occupant: undefined })).toEqual({
      kind: 'attempt',
      action: { kind: 'move', fighter: 'A:Pusher', cell: 'D4' },
    });
    expect(resolveCellClick({ cell: 'D4', human: 'A', selection: undefined, options: [], occupant: undefined }).kind).toBe('hint');
  });
});
