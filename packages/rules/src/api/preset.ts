import type { ObjectiveId } from './fighters';

export type OpeningRule = 'outside-edge-no-constraint';
export type AnchorProtection = 'through-opponent-next-turn' | 'through-owner-following-turn';
export type TerminalCheck = 'objective' | 'blockade' | 'repetition';

/** Rule-variant switches paper test 01 left open (PRD §6, rows marked variant). */
export interface PresetVariants {
  readonly anchorProtection: AnchorProtection;
  readonly pullerMayTargetAllies: boolean;
  readonly lockedFightersCountTowardObjective: boolean;
  /** At most this many of Pusher, Puller and Swapper per roster; null means no limit. */
  readonly displacerLimit: number | null;
}

/**
 * A rules preset: every provisional value of spec §13 as data (PRD P1, §6).
 * A match records its preset so an old log replays under the rules it was played with (PRD P3).
 */
export interface Preset {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly rosterSize: number;
  readonly rechargesPerPlayer: number;
  readonly setupTrapsPerPlayer: number;
  readonly setupTrapsOnDistinctCells: boolean;
  readonly liveTrapsPerOwnerPerCell: number;
  readonly openingRule: OpeningRule;
  readonly trapsTriggerOnOpening: boolean;
  /** How many of its owner's turns a locked fighter misses; reapplying extends, never stacks. */
  readonly lockOwnTurnsMissed: number;
  readonly trapCheckerRule: 'single-adjacent-cell';
  readonly trapCheckerLegalWithNothingFound: boolean;
  readonly trapperDestinationMustMatch: boolean;
  readonly trapperKeepsConstraint: boolean;
  readonly sameTypesAcrossRosters: boolean;
  /** Draw on this occurrence of the same full start-of-turn state. */
  readonly repetitionThreshold: number;
  readonly terminalPrecedence: readonly TerminalCheck[];
  readonly objectivePool: readonly ObjectiveId[];
  readonly variants: PresetVariants;
}
