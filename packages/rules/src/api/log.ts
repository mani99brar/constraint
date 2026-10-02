import type { Action } from './actions';
import type { PlayerId } from './fighters';
import type { Preset } from './preset';
import type { Scenario, Setup } from './setup';

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
