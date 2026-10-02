import type { Action, CellId, FighterId, FighterState, PlayerId } from '@okiya/rules';

/** One legal action of the selected fighter; `cell` is where it is chosen on the board, if anywhere. */
export interface ActionOption {
  readonly action: Action;
  readonly cell: CellId | null;
}

/** The cell an action is chosen on: its destination or target; recharge has none. */
export function actionCell(action: Action): CellId | null {
  switch (action.kind) {
    case 'deploy':
    case 'move':
      return action.cell;
    case 'ability':
      return action.target;
    case 'recharge':
      return null;
  }
}

/**
 * The legal actions of one fighter, one entry per action of the legal-action list and in its
 * order (PRD R3). Driven by the list alone, so new abilities appear without interface changes.
 */
export function optionsFor(legalActions: readonly Action[], fighter: FighterId | null | undefined): ActionOption[] {
  if (!fighter) return [];
  return legalActions.filter((action) => action.fighter === fighter).map((action) => ({ action, cell: actionCell(action) }));
}

/** The highlighted cells of a selection, each with the options chosen on it. */
export function highlightedCells(options: readonly ActionOption[]): Map<CellId, ActionOption[]> {
  const cells = new Map<CellId, ActionOption[]>();
  for (const option of options) {
    if (option.cell === null) continue;
    cells.set(option.cell, [...(cells.get(option.cell) ?? []), option]);
  }
  return cells;
}

/** One entry of the chooser shown when a click on a cell could mean more than one thing. */
export type CellChoice = { readonly kind: 'action'; readonly action: Action } | { readonly kind: 'select'; readonly fighter: FighterId };

/** What a click on a board cell does during the player's turn. */
export type CellClick =
  /** Exactly one legal action is chosen on this cell. */
  | { readonly kind: 'apply'; readonly action: Action }
  /** Several legal actions, or a legal action and another own fighter to select. */
  | { readonly kind: 'choose'; readonly cell: CellId; readonly choices: readonly CellChoice[] }
  | { readonly kind: 'select'; readonly fighter: FighterId }
  /** No legal action here: attempt the plain deploy or move so the engine gives its refusal (PRD R4). */
  | { readonly kind: 'attempt'; readonly action: Action }
  | { readonly kind: 'hint'; readonly message: string };

export interface CellClickInput {
  readonly cell: CellId;
  readonly human: PlayerId;
  readonly selection: FighterState | undefined;
  readonly options: readonly ActionOption[];
  readonly occupant: FighterState | undefined;
}

export function resolveCellClick({ cell, human, selection, options, occupant }: CellClickInput): CellClick {
  const choices: CellChoice[] = options.filter((option) => option.cell === cell).map((option) => ({ kind: 'action', action: option.action }));
  if (occupant?.owner === human && occupant.id !== selection?.id) choices.push({ kind: 'select', fighter: occupant.id });
  if (choices.length === 1) {
    const [only] = choices as [CellChoice];
    return only.kind === 'action' ? { kind: 'apply', action: only.action } : { kind: 'select', fighter: only.fighter };
  }
  if (choices.length > 1) return { kind: 'choose', cell, choices };
  if (!selection) return { kind: 'hint', message: 'Select one of your fighters first.' };
  return { kind: 'attempt', action: { kind: selection.cell === null ? 'deploy' : 'move', fighter: selection.id, cell } };
}

/** The cells marked as playable on the board: the selection's legal cells, or none with highlights off (PRD E4). */
export function markedCells(options: readonly ActionOption[], highlights: boolean): Set<CellId> {
  return highlights ? new Set(highlightedCells(options).keys()) : new Set();
}
