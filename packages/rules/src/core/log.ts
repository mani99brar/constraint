import type { Tile } from '../api/board';
import {
  MATCH_LOG_FORMAT_VERSION,
  type MatchLog,
  type ParseMatchLogResult,
  type ReplayStepsResult,
} from '../api/log';
import type { MatchState } from '../api/state';
import { applyAction } from './apply';
import { InvalidSetupError, prepareMatch, startMatch } from './setup';

/** The replayable log of a match (PRD L2). It contains both sides' hidden setups. */
export function matchLogOf(state: MatchState): MatchLog {
  return {
    formatVersion: MATCH_LOG_FORMAT_VERSION,
    preset: { id: state.preset.id, version: state.preset.version, values: state.preset },
    seed: state.seed,
    scenario: state.scenario,
    setups: state.setups,
    actions: state.history.map((entry) => entry.action),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Reads an untrusted value, such as a parsed JSON file, as a match log (PRD L3). Checks the
 * format version and the shape of every field the replay reads. The values themselves (preset
 * contents, setups, actions) are checked by replaying, which refuses them with a structured reason.
 */
export function parseMatchLog(input: unknown): ParseMatchLogResult {
  const refuse = (field: string): ParseMatchLogResult => ({ ok: false, refusal: { code: 'not-a-match-log', field } });
  if (!isRecord(input)) return refuse('');
  if (input.formatVersion !== MATCH_LOG_FORMAT_VERSION) {
    return { ok: false, refusal: { code: 'unsupported-format-version', found: input.formatVersion } };
  }
  const { preset, seed, scenario, setups, actions } = input;
  if (!isRecord(preset) || typeof preset.id !== 'string' || typeof preset.version !== 'string') return refuse('preset');
  if (!isRecord(preset.values)) return refuse('preset.values');
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) return refuse('seed');
  if (scenario !== null && !isRecord(scenario)) return refuse('scenario');
  if (!isRecord(setups)) return refuse('setups');
  for (const side of ['A', 'B'] as const) {
    const setup = setups[side];
    if (!isRecord(setup)) return refuse(`setups.${side}`);
    if (!isStringArray(setup.roster)) return refuse(`setups.${side}.roster`);
    if (!isStringArray(setup.traps)) return refuse(`setups.${side}.traps`);
  }
  if (!Array.isArray(actions)) return refuse('actions');
  for (const [index, action] of actions.entries()) {
    if (!isRecord(action) || typeof action.kind !== 'string') return refuse(`actions.${index}`);
  }
  return { ok: true, log: input as unknown as MatchLog };
}

/**
 * Replays a match log and returns every intermediate state (PRD L1, L3): the state after setup,
 * then one state per action. Stops at the first refused setup or action with a structured reason.
 */
export function replayMatchSteps(log: MatchLog, tiles: readonly Tile[]): ReplayStepsResult {
  let state: MatchState;
  try {
    const prepared = prepareMatch({
      tiles,
      preset: log.preset.values,
      seed: log.seed,
      ...(log.scenario ? { scenario: log.scenario } : {}),
    });
    state = startMatch(prepared, log.setups);
  } catch (error) {
    if (error instanceof InvalidSetupError) return { ok: false, refusal: { code: 'setup-refused', refusals: error.refusals } };
    throw error;
  }
  const states: MatchState[] = [state];
  for (const [index, action] of log.actions.entries()) {
    const applied = applyAction(state, action);
    if (!applied.ok) return { ok: false, refusal: { code: 'action-refused', actionIndex: index, refusal: applied.refusal } };
    state = applied.state;
    states.push(state);
  }
  return { ok: true, states };
}

/** Replays a match log to its final state (PRD L1). Throws on a refused setup or action. */
export function replayMatchLog(log: MatchLog, tiles: readonly Tile[]): MatchState {
  const result = replayMatchSteps(log, tiles);
  if (!result.ok) throw new Error(`Match log refused: ${JSON.stringify(result.refusal)}`);
  return result.states[result.states.length - 1]!;
}
