import type { CellId, Constraint, Tile } from './board';
import type { FighterId, PlayerId } from './fighters';
import type { ResolutionEvent } from './events';
import type { MatchState } from './state';

/** Deploy a reserve fighter onto a cell (spec §7.1). */
export interface DeployAction {
  readonly kind: 'deploy';
  readonly fighter: FighterId;
  readonly cell: CellId;
}

/** Move a deployed fighter one orthogonal square (spec §7.2). */
export interface MoveAction {
  readonly kind: 'move';
  readonly fighter: FighterId;
  readonly cell: CellId;
}

/** Spend a shared recharge action on a fighter with charge 0 (spec §7.3). */
export interface RechargeAction {
  readonly kind: 'recharge';
  readonly fighter: FighterId;
}

/** Activate a fighter's ability on one target cell (spec §7.4). */
export interface AbilityAction {
  readonly kind: 'ability';
  readonly fighter: FighterId;
  readonly target: CellId;
}

/**
 * One concrete choice of the active player. The legal-action list has one entry per choice:
 * deploy and move per fighter and cell, ability per actor and target cell, recharge per fighter.
 */
export type Action = DeployAction | MoveAction | RechargeAction | AbilityAction;

/** Structured refusal of an action: a reason code and its data, never English text. */
export type ActionRefusal =
  | { readonly code: 'match-over' }
  // One code for a fighter that does not exist and one the opponent owns, so a refusal never
  // reveals which types sit in the opponent's hidden reserve (spec §4).
  | { readonly code: 'not-your-fighter'; readonly fighter: string; readonly activePlayer: PlayerId }
  | { readonly code: 'unknown-cell'; readonly cell: string }
  | { readonly code: 'not-in-reserve'; readonly fighter: FighterId }
  | { readonly code: 'not-deployed'; readonly fighter: FighterId }
  | { readonly code: 'opening-must-deploy' }
  | { readonly code: 'not-edge-cell'; readonly cell: CellId }
  | { readonly code: 'cell-occupied'; readonly cell: CellId }
  | { readonly code: 'no-match'; readonly cell: CellId; readonly tile: Tile; readonly constraint: Constraint }
  | { readonly code: 'not-adjacent'; readonly from: CellId; readonly to: CellId }
  | { readonly code: 'fighter-locked'; readonly fighter: FighterId }
  | { readonly code: 'no-charge'; readonly fighter: FighterId }
  | { readonly code: 'already-charged'; readonly fighter: FighterId }
  | { readonly code: 'no-recharges-left'; readonly player: PlayerId }
  | { readonly code: 'invalid-target'; readonly fighter: FighterId; readonly target: CellId };

/** The outcome of applying one action: the next state and its ordered events, or a refusal. */
export type ApplyResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly ResolutionEvent[] }
  | { readonly ok: false; readonly refusal: ActionRefusal };
