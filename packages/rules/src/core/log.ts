import type { Tile } from '../api/board';
import { MATCH_LOG_FORMAT_VERSION, type MatchLog } from '../api/log';
import type { MatchState } from '../api/state';
import { applyAction } from './apply';
import { prepareMatch, startMatch } from './setup';

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

/** Replays a match log from its preset, seed, scenario and setups (PRD L1). Throws on a refused action. */
export function replayMatchLog(log: MatchLog, tiles: readonly Tile[]): MatchState {
  const prepared = prepareMatch({
    tiles,
    preset: log.preset.values,
    seed: log.seed,
    ...(log.scenario ? { scenario: log.scenario } : {}),
  });
  let state = startMatch(prepared, log.setups);
  for (const [index, action] of log.actions.entries()) {
    const applied = applyAction(state, action);
    if (!applied.ok) throw new Error(`Action ${index + 1} refused: ${JSON.stringify(applied.refusal)}`);
    state = applied.state;
  }
  return state;
}
