import type { Board, Constraint } from './board';
import type { Action } from './actions';
import type { FighterId, FighterType, ObjectiveId, PlayerId } from './fighters';
import type { PlayerEvent } from './events';
import type { Preset } from './preset';
import type { FighterState, InspectionRecord, LiveTrap, MatchResult, TrapRecord } from './state';

/** A Trapper placement as the other side sees it: the target cell is hidden (spec §4, PRD I2). */
export interface RedactedAbilityAction {
  readonly kind: 'ability';
  readonly fighter: FighterId;
  readonly target: null;
}

export type PublicAction = Action | RedactedAbilityAction;

export interface PublicLogEntry {
  readonly turn: number;
  readonly player: PlayerId;
  readonly action: PublicAction;
  readonly events: readonly PlayerEvent[];
}

/** Hidden information, revealed to both sides once the match has ended (PRD R6). */
export interface MatchReveal {
  readonly objectives: Readonly<Record<PlayerId, ObjectiveId>>;
  readonly rosters: Readonly<Record<PlayerId, readonly FighterType[]>>;
  readonly trapHistory: readonly TrapRecord[];
}

/**
 * Everything one player may know (spec §4). It never holds the opponent's objective, reserve
 * identities, live trap locations or inspection results while the match runs.
 */
export interface PlayerView {
  readonly viewer: PlayerId;
  /** Match seed and turn number, which seed the bot's generator. */
  readonly seed: number;
  readonly turn: number;
  readonly activePlayer: PlayerId;
  readonly startingPlayer: PlayerId;
  readonly preset: Preset;
  readonly board: Board;
  readonly constraint: Constraint | null;
  /** Every deployed fighter, plus the viewer's own reserve. */
  readonly fighters: readonly FighterState[];
  readonly reserveCounts: Readonly<Record<PlayerId, number>>;
  readonly deployedCounts: Readonly<Record<PlayerId, number>>;
  readonly recharges: Readonly<Record<PlayerId, number>>;
  readonly objective: ObjectiveId;
  readonly ownTraps: readonly LiveTrap[];
  readonly log: readonly PublicLogEntry[];
  /** The viewer's own Trap Checker results. */
  readonly inspections: readonly InspectionRecord[];
  readonly result: MatchResult | null;
  /** Present only once the match has ended. */
  readonly reveal?: MatchReveal;
}
