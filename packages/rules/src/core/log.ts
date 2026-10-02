import { ALL_CELLS, isCellId, SYMBOLS, TERRAINS, type Tile } from '../api/board';
import { isFighterType, PLAYERS } from '../api/fighters';
import {
  MATCH_LOG_FORMAT_VERSION,
  type MatchLog,
  type ParseMatchLogResult,
  type ReplayStepsResult,
} from '../api/log';
import type { MatchState } from '../api/state';
import { applyAction } from './apply';
import { presetIssues } from './preset';
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
const isString = (value: unknown): value is string => typeof value === 'string';
const isFighter = (value: unknown): boolean => isString(value) && isFighterType(value);
const isCell = (value: unknown): boolean => isString(value) && isCellId(value);
const isPlayer = (value: unknown): boolean => value === 'A' || value === 'B';

/** The path of the first item of a list that is not an array of `isItem` items, or null. */
function listIssue(value: unknown, path: string, isItem: (item: unknown) => boolean): string | null {
  if (!Array.isArray(value)) return path;
  const index = value.findIndex((item) => !isItem(item));
  return index < 0 ? null : `${path}.${index}`;
}

/** The path of the first malformed part of a board: every cell holds a known tile, each tile once. */
function boardIssue(board: unknown, path: string): string | null {
  if (!isRecord(board)) return path;
  const seen = new Set<string>();
  for (const cell of ALL_CELLS) {
    const tile = board[cell];
    if (!isRecord(tile)) return `${path}.${cell}`;
    if (!(TERRAINS as readonly unknown[]).includes(tile.terrain)) return `${path}.${cell}.terrain`;
    if (!(SYMBOLS as readonly unknown[]).includes(tile.symbol)) return `${path}.${cell}.symbol`;
    const key = `${String(tile.terrain)}-${String(tile.symbol)}`;
    if (seen.has(key)) return `${path}.${cell}`;
    seen.add(key);
  }
  return null;
}

/** The path of the first malformed per-player part of a scenario, such as `scenario.rosters.B.2`. */
function perPlayerIssue(value: unknown, path: string, isItem: (item: unknown) => boolean): string | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return path;
  for (const player of PLAYERS) {
    if (value[player] === undefined) continue;
    const issue = listIssue(value[player], `${path}.${player}`, isItem);
    if (issue !== null) return issue;
  }
  return null;
}

function scenarioIssue(scenario: unknown): string | null {
  if (scenario === null) return null;
  if (!isRecord(scenario)) return 'scenario';
  if (!isString(scenario.id)) return 'scenario.id';
  if (!isString(scenario.name)) return 'scenario.name';
  if (scenario.board !== undefined) {
    const issue = boardIssue(scenario.board, 'scenario.board');
    if (issue !== null) return issue;
  }
  const issue =
    perPlayerIssue(scenario.rosters, 'scenario.rosters', isFighter) ?? perPlayerIssue(scenario.traps, 'scenario.traps', isCell);
  if (issue !== null) return issue;
  if (scenario.startingPlayer !== undefined && !isPlayer(scenario.startingPlayer)) return 'scenario.startingPlayer';
  return null;
}

/** An action's fields the replay reads; an unknown kind passes, so the replay refuses it with its index. */
function actionIssue(action: unknown, path: string): string | null {
  if (!isRecord(action) || !isString(action.kind)) return path;
  const { kind } = action;
  if (kind !== 'deploy' && kind !== 'move' && kind !== 'recharge' && kind !== 'ability') return null;
  if (!isString(action.fighter)) return `${path}.fighter`;
  if ((kind === 'deploy' || kind === 'move') && !isString(action.cell)) return `${path}.cell`;
  if (kind === 'ability' && !isString(action.target)) return `${path}.target`;
  return null;
}

/** The path of the first field of an untrusted log that the replay cannot read safely, or null. */
function logIssue(input: Record<string, unknown>): string | null {
  const { preset, seed, scenario, setups, actions } = input;
  if (!isRecord(preset) || !isString(preset.id) || !isString(preset.version)) return 'preset';
  if (!isRecord(preset.values)) return 'preset.values';
  const presetIssue = presetIssues(preset.values)[0];
  if (presetIssue) return `preset.values.${presetIssue.field}`;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) return 'seed';
  const issue = scenarioIssue(scenario);
  if (issue !== null) return issue;
  if (!isRecord(setups)) return 'setups';
  for (const side of PLAYERS) {
    const setup = setups[side];
    if (!isRecord(setup)) return `setups.${side}`;
    const setupIssue = listIssue(setup.roster, `setups.${side}.roster`, isFighter) ?? listIssue(setup.traps, `setups.${side}.traps`, isCell);
    if (setupIssue !== null) return setupIssue;
  }
  if (!Array.isArray(actions)) return 'actions';
  for (const [index, action] of actions.entries()) {
    const actionPath = actionIssue(action, `actions.${index}`);
    if (actionPath !== null) return actionPath;
  }
  return null;
}

/**
 * Reads an untrusted value, such as a parsed JSON file or a match saved in browser storage, as a
 * match log (PRD L3). Checks the format version, the preset values against the rules the engine
 * plays under, the scenario, that setups name known fighters and cells, and the fields of every
 * action. What only the rules decide (setup counts and distinctness, the legality of each
 * action) is checked by replaying, which refuses it with a structured reason.
 */
export function parseMatchLog(input: unknown): ParseMatchLogResult {
  if (!isRecord(input)) return { ok: false, refusal: { code: 'not-a-match-log', field: '' } };
  if (input.formatVersion !== MATCH_LOG_FORMAT_VERSION) {
    return { ok: false, refusal: { code: 'unsupported-format-version', found: input.formatVersion } };
  }
  const field = logIssue(input);
  if (field !== null) return { ok: false, refusal: { code: 'not-a-match-log', field } };
  return { ok: true, log: input as unknown as MatchLog };
}

/**
 * Replays a match log and returns every intermediate state (PRD L1, L3): the state after setup,
 * then one state per action. Stops at the first refused setup or action with a structured reason.
 * The log is read again with `parseMatchLog` first, so a log that was never parsed, or was
 * changed after parsing, is refused the same way instead of throwing.
 */
export function replayMatchSteps(log: MatchLog, tiles: readonly Tile[]): ReplayStepsResult {
  const parsed = parseMatchLog(log);
  if (!parsed.ok) return parsed;
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
