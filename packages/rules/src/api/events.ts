import type { CellId, Constraint } from './board';
import type { FighterId, PlayerId } from './fighters';
import type { EntryMode } from './abilities';
import type { MatchResult, TrapId } from './state';

export interface TrapPlacedEvent {
  readonly kind: 'trap-placed';
  readonly owner: PlayerId;
  readonly trapId: TrapId;
  readonly cell: CellId;
}

export interface TrapsInspectedEvent {
  readonly kind: 'traps-inspected';
  readonly inspector: PlayerId;
  readonly actor: FighterId;
  readonly cell: CellId;
  /** Number of enemy traps found and removed. */
  readonly removed: number;
}

/** Events that are public as they are. */
export type PublicResolutionEvent =
  | { readonly kind: 'fighter-entered'; readonly fighter: FighterId; readonly from: CellId | null; readonly to: CellId; readonly entry: EntryMode }
  | { readonly kind: 'charge-spent'; readonly fighter: FighterId }
  | { readonly kind: 'recharge-spent'; readonly player: PlayerId; readonly remaining: number }
  | { readonly kind: 'charge-restored'; readonly fighter: FighterId }
  | { readonly kind: 'terrain-exchanged'; readonly cells: readonly [CellId, CellId] }
  | { readonly kind: 'protection-applied'; readonly fighter: FighterId; readonly expiresAfterTurn: number }
  | { readonly kind: 'trap-triggered'; readonly trapId: TrapId; readonly owner: PlayerId; readonly cell: CellId; readonly fighter: FighterId }
  | { readonly kind: 'charge-lost'; readonly fighter: FighterId }
  | { readonly kind: 'lock-applied'; readonly fighter: FighterId; readonly expiresAfterTurn: number }
  | { readonly kind: 'constraint-set'; readonly constraint: Constraint }
  | { readonly kind: 'match-ended'; readonly result: MatchResult };

/**
 * The referee's resolution events of one action, in order (spec §11, PRD R5): positions, trap
 * triggers, charge loss or lock, the new constraint, then the match end.
 */
export type ResolutionEvent = PublicResolutionEvent | TrapPlacedEvent | TrapsInspectedEvent;

/** A trap placement as one player sees it: the cell is null unless the viewer owns the trap. */
export interface PlayerTrapPlacedEvent {
  readonly kind: 'trap-placed';
  readonly owner: PlayerId;
  readonly cell: CellId | null;
}

/** An inspection as one player sees it: the result is null unless the viewer inspected. */
export interface PlayerTrapsInspectedEvent {
  readonly kind: 'traps-inspected';
  readonly inspector: PlayerId;
  readonly actor: FighterId;
  readonly cell: CellId;
  readonly removed: number | null;
}

/** A resolution event projected for one player; the only form events reach the client in. */
export type PlayerEvent = PublicResolutionEvent | PlayerTrapPlacedEvent | PlayerTrapsInspectedEvent;
