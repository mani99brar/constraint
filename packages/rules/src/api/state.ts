import type { Board, CellId, Constraint } from './board';
import type { FighterId, FighterType, ObjectiveId, PlayerId } from './fighters';
import type { Preset } from './preset';
import type { Scenario, Setup } from './setup';
import type { Action } from './actions';
import type { ResolutionEvent } from './events';

/** Serialized state of the seeded generator (pure-rand xoroshiro128+), kept in the match state. */
export type RngState = readonly number[];

/** A locked fighter cannot initiate movement, abilities or be recharged (spec §8.2). */
export interface Lock {
  /** The lock expires at the end of this turn number (spec §11 step 8). */
  readonly expiresAfterTurn: number;
}

/** Anchor protection against enemy-forced push, pull or swap (spec §9). */
export interface Protection {
  readonly expiresAfterTurn: number;
  readonly by: FighterId;
}

export type Charge = 0 | 1;

export interface FighterState {
  readonly id: FighterId;
  readonly owner: PlayerId;
  readonly type: FighterType;
  /** Null while the fighter is in reserve. */
  readonly cell: CellId | null;
  readonly charge: Charge;
  readonly lock: Lock | null;
  readonly protection: Protection | null;
}

export type TrapId = string;

export interface LiveTrap {
  readonly id: TrapId;
  readonly owner: PlayerId;
  readonly cell: CellId;
}

export type TrapFate =
  | { readonly kind: 'live' }
  | { readonly kind: 'triggered'; readonly turn: number; readonly fighter: FighterId }
  | { readonly kind: 'removed'; readonly turn: number; readonly by: FighterId };

/** Every trap ever placed, at setup or by the Trapper, with its fate; revealed at match end (PRD R6). */
export interface TrapRecord {
  readonly id: TrapId;
  readonly owner: PlayerId;
  readonly cell: CellId;
  readonly source: 'setup' | 'trapper';
  /** 0 for setup traps. */
  readonly placedOnTurn: number;
  readonly placedBy: FighterId | null;
  readonly fate: TrapFate;
}

/** A Trap Checker inspection; private to the inspector (spec §4, §9). */
export interface InspectionRecord {
  readonly turn: number;
  readonly inspector: PlayerId;
  readonly actor: FighterId;
  readonly cell: CellId;
  readonly removedTrapIds: readonly TrapId[];
}

/** One applied action with the referee's full resolution events. */
export interface HistoryEntry {
  readonly turn: number;
  readonly player: PlayerId;
  readonly action: Action;
  readonly events: readonly ResolutionEvent[];
}

export type MatchResult =
  | { readonly kind: 'win'; readonly winner: PlayerId; readonly reason: 'objective' | 'blockade' }
  | { readonly kind: 'draw'; readonly reason: 'simultaneous-objective' | 'repetition' };

/** Canonical signature of a full start-of-turn gameplay state (spec §12). */
export type StateSignature = string;

/** The referee's complete, plain, serializable match state. */
export interface MatchState {
  readonly preset: Preset;
  readonly seed: number;
  readonly scenario: Scenario | null;
  readonly board: Board;
  readonly rng: RngState;
  readonly objectives: Readonly<Record<PlayerId, ObjectiveId>>;
  readonly setups: Readonly<Record<PlayerId, Setup>>;
  readonly startingPlayer: PlayerId;
  readonly fighters: readonly FighterState[];
  /** Null before the opening deployment. */
  readonly constraint: Constraint | null;
  readonly activePlayer: PlayerId;
  /** Turn number of the active turn, starting at 1. */
  readonly turn: number;
  readonly recharges: Readonly<Record<PlayerId, number>>;
  readonly traps: readonly LiveTrap[];
  readonly trapHistory: readonly TrapRecord[];
  readonly inspections: readonly InspectionRecord[];
  readonly history: readonly HistoryEntry[];
  /** Start-of-turn signatures in order, for the repetition draw (spec §12). */
  readonly repetition: readonly StateSignature[];
  readonly result: MatchResult | null;
}
