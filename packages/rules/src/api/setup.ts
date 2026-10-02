import type { Board, CellId } from './board';
import type { FighterType, PlayerId } from './fighters';
import type { Preset } from './preset';
import type { RngState } from './state';

/** One side's secret setup choice: its roster and its setup trap cells (spec §5 steps 3 and 5). */
export interface Setup {
  readonly roster: readonly FighterType[];
  readonly traps: readonly CellId[];
}

/**
 * A scenario replaces any part of setup for testing (PRD S4). The board applies when the match
 * is prepared; rosters, traps and the starting player apply when it starts.
 */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly board?: Board;
  readonly rosters?: Partial<Record<PlayerId, readonly FighterType[]>>;
  readonly traps?: Partial<Record<PlayerId, readonly CellId[]>>;
  readonly startingPlayer?: PlayerId;
}

/** The first setup phase: the board is shuffled and revealed, no side has chosen yet. */
export interface PreparedMatch {
  readonly preset: Preset;
  readonly seed: number;
  readonly board: Board;
  readonly rng: RngState;
  readonly scenario: Scenario | null;
}

/** What a side sees when choosing its setup: the revealed board, the preset and the seed. */
export interface SetupInput {
  readonly board: Board;
  readonly preset: Preset;
  readonly seed: number;
}

/** Structured setup refusals; the client turns codes into readable text. */
export type SetupRefusal =
  | { readonly code: 'roster-size'; readonly expected: number; readonly actual: number }
  | { readonly code: 'unknown-fighter'; readonly fighter: string }
  | { readonly code: 'fighters-not-distinct'; readonly fighter: FighterType }
  | { readonly code: 'displacer-limit'; readonly limit: number; readonly actual: number }
  | { readonly code: 'trap-count'; readonly expected: number; readonly actual: number }
  | { readonly code: 'unknown-cell'; readonly cell: string }
  | { readonly code: 'trap-cells-not-distinct'; readonly cell: CellId };
