import type { Action, ActionRefusal } from './actions';
import type { PlayerId } from './fighters';
import type { Preset } from './preset';
import type { Scenario, Setup, SetupRefusal } from './setup';
import type { MatchState } from './state';

export const MATCH_LOG_FORMAT_VERSION = 1;

/** A replayable match (PRD L2): preset, seed, scenario, both setups and every action in order. */
export interface MatchLog {
  readonly formatVersion: typeof MATCH_LOG_FORMAT_VERSION;
  readonly preset: { readonly id: string; readonly version: string; readonly values: Preset };
  readonly seed: number;
  readonly scenario: Scenario | null;
  readonly setups: Readonly<Record<PlayerId, Setup>>;
  readonly actions: readonly Action[];
}

/**
 * Why a match log cannot be loaded or replayed (PRD L3). Codes, never English text: the client
 * turns them into readable reasons. `field` names the offending path, for example `setups.B.traps`.
 */
export type MatchLogRefusal =
  | { readonly code: 'not-a-match-log'; readonly field: string }
  | { readonly code: 'unsupported-format-version'; readonly found: unknown }
  | { readonly code: 'setup-refused'; readonly refusals: Readonly<Record<PlayerId, readonly SetupRefusal[]>> }
  | { readonly code: 'action-refused'; readonly actionIndex: number; readonly refusal: ActionRefusal };

/** The outcome of reading an untrusted value as a match log. */
export type ParseMatchLogResult =
  | { readonly ok: true; readonly log: MatchLog }
  | { readonly ok: false; readonly refusal: MatchLogRefusal };

/**
 * The outcome of replaying a log step by step: `states[0]` is the state after setup and
 * `states[n]` the state after action n, so a client can step through or continue from any point.
 */
export type ReplayStepsResult =
  | { readonly ok: true; readonly states: readonly MatchState[] }
  | { readonly ok: false; readonly refusal: MatchLogRefusal };
