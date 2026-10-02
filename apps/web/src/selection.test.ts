import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { ALL_CELLS, applyAction, listLegalActions, playerView, type Action, type CellId, type FighterState } from '@okiya/rules';
import { Board } from './Board';
import { createMatch, HUMAN, prepare } from './match';
import { highlightedCells, markedCells, optionsFor, resolveCellClick } from './selection';
import { defaultHumanSetup } from './setup';
import { describeRefusal } from './text';

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

describe('move highlights setting (PRD E4)', () => {
  const view = playerView(createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3), HUMAN);
  const state = createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3);
  const legal = listLegalActions(state);
  it('starts with the human to move', () => expect(state.activePlayer).toBe(HUMAN));
  const fighter = legal[0]!.fighter;
  const options = optionsFor(legal, fighter);

  function boardHtml(highlights: boolean) {
    return renderToStaticMarkup(
      createElement(Board, {
        testId: 'board',
        board: view.board,
        human: HUMAN,
        fighters: view.fighters,
        ownTraps: new Set<CellId>(),
        highlighted: markedCells(options, highlights),
        onCellClick: () => {},
      }),
    );
  }

  it('marks the legal cells with highlights on, and no cell with them off', () => {
    expect(options.length).toBeGreaterThan(0);
    expect(markedCells(options, true).size).toBe(highlightedCells(options).size);
    expect(boardHtml(true).match(/data-highlighted="true"/g)?.length).toBe(highlightedCells(options).size);
    expect(markedCells(options, false).size).toBe(0);
    expect(boardHtml(false)).not.toContain('data-highlighted="true"');
    expect(boardHtml(false)).not.toContain(' highlighted');
  });

  it('leaves the legal actions and the refusal reasons unchanged with highlights off', () => {
    // The setting only changes what the board marks: options and clicks come from the legal-action list.
    const legalCell = options[0]!.cell!;
    const click = (cell: CellId) =>
      resolveCellClick({ cell, human: HUMAN, selection: view.fighters.find((candidate) => candidate.id === fighter), options, occupant: undefined });
    expect(click(legalCell)).toEqual({ kind: 'apply', action: options[0]!.action });
    const illegal = ALL_CELLS.find((cell) => !options.some((option) => option.cell === cell))!;
    const attempt = click(illegal);
    expect(attempt.kind).toBe('attempt');
    if (attempt.kind !== 'attempt') return;
    const refused = applyAction(state, attempt.action);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(describeRefusal(refused.refusal)).toMatch(/not on the outside edge|does not match|occupied/);
    expect(listLegalActions(state)).toEqual(legal);
  });
});
