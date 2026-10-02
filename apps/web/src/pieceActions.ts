import type { Action, CellId, FighterId, FighterState, FighterType, PlayerId } from '@okiya/rules';
import { fighterName } from './text';

/**
 * A selected token either shows where it can go (deploy or move) or, once its ability button is
 * chosen, where its ability can be aimed (PRD T3, R3).
 */
export type PieceMode = 'move' | 'ability';

export interface PieceSelection {
  readonly fighter: FighterState;
  readonly mode: PieceMode;
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

/** The verb on each fighter's ability button. */
export const ABILITY_VERBS: Readonly<Record<FighterType, string>> = {
  Teleporter: 'Teleport',
  Pusher: 'Push',
  Swapper: 'Swap',
  Upgrader: 'Give charge',
  TrapChecker: 'Inspect',
  Puller: 'Pull',
  Anchor: 'Protect',
  TerrainWeaver: 'Weave',
  Trapper: 'Set trap',
};

/** A button drawn beside a selected token: its ability or a recharge, each only when legal. */
export interface PieceButton {
  readonly kind: 'ability' | 'recharge';
  readonly text: string;
  readonly label: string;
  /** The legal actions behind the button: every ability target, or the one recharge. */
  readonly actions: readonly Action[];
}

/**
 * The on-token buttons of a fighter: exactly its legal ability actions, as one button that makes
 * their targets glow, and its legal recharge, from the legal-action list alone.
 */
export function pieceButtons(legalActions: readonly Action[], fighter: FighterState | null | undefined): PieceButton[] {
  if (!fighter) return [];
  const own = legalActions.filter((action) => action.fighter === fighter.id);
  const abilities = own.filter((action) => action.kind === 'ability');
  const recharges = own.filter((action) => action.kind === 'recharge');
  const name = fighterName(fighter.type);
  const buttons: PieceButton[] = [];
  if (abilities.length > 0) {
    buttons.push({ kind: 'ability', text: ABILITY_VERBS[fighter.type], label: `${name} ability: ${ABILITY_VERBS[fighter.type]}`, actions: abilities });
  }
  if (recharges.length > 0) buttons.push({ kind: 'recharge', text: 'Recharge', label: `Recharge ${name}`, actions: recharges });
  return buttons;
}

/** The legal actions of the selection's current mode that are chosen on a cell. */
export function modeActions(legalActions: readonly Action[], selection: PieceSelection | null): Action[] {
  if (!selection) return [];
  return legalActions.filter(
    (action) =>
      action.fighter === selection.fighter.id &&
      (selection.mode === 'ability' ? action.kind === 'ability' : action.kind === 'deploy' || action.kind === 'move'),
  );
}

/**
 * The cells that glow for a selection: its legal deploy or move cells, or its legal ability
 * targets once the ability is chosen; none with highlights off (PRD E4).
 */
export function glowingCells(legalActions: readonly Action[], selection: PieceSelection | null, highlights = true): Set<CellId> {
  if (!highlights) return new Set();
  return new Set(modeActions(legalActions, selection).flatMap((action) => actionCell(action) ?? []));
}

/** The tokens that can act now, which glow in the trays and on the board while highlights are on. */
export function playableFighters(legalActions: readonly Action[], highlights = true): Set<FighterId> {
  return highlights ? new Set(legalActions.map((action) => action.fighter)) : new Set();
}

/** What a tap on a board cell does during the player's turn. */
export type CellTap =
  | { readonly kind: 'apply'; readonly action: Action }
  | { readonly kind: 'select'; readonly fighter: FighterId }
  | { readonly kind: 'cancel' }
  /** No legal action here: the plain deploy, move or ability is attempted so the engine gives its refusal (PRD R4). */
  | { readonly kind: 'attempt'; readonly action: Action }
  | { readonly kind: 'hint'; readonly message: string };

export interface CellTapInput {
  readonly cell: CellId;
  readonly human: PlayerId;
  readonly selection: PieceSelection | null;
  readonly legalActions: readonly Action[];
  readonly occupant: FighterState | undefined;
}

export const SELECT_FIRST = 'Tap one of your tokens first.';

export function resolveCellTap({ cell, human, selection, legalActions, occupant }: CellTapInput): CellTap {
  if (!selection) {
    return occupant?.owner === human ? { kind: 'select', fighter: occupant.id } : { kind: 'hint', message: SELECT_FIRST };
  }
  const action = modeActions(legalActions, selection).find((candidate) => actionCell(candidate) === cell);
  if (action) return { kind: 'apply', action };
  const { fighter } = selection;
  if (cell === fighter.cell) return { kind: 'cancel' };
  if (occupant?.owner === human) return { kind: 'select', fighter: occupant.id };
  if (selection.mode === 'ability') return { kind: 'attempt', action: { kind: 'ability', fighter: fighter.id, target: cell } };
  return { kind: 'attempt', action: { kind: fighter.cell === null ? 'deploy' : 'move', fighter: fighter.id, cell } };
}
