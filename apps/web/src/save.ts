import { TILES } from '@okiya/content';
import { matchLogOf, parseMatchLog, replayMatchSteps, type MatchState } from '@okiya/rules';
import { isBotDepth, type BotDepthId } from './difficulty';
import { PRESET } from './match';
import { isRecord, readText, removeKey, writeJson, type KeyValueStorage } from './storage';

/**
 * The unfinished match, saved after every action and offered as Continue (PRD E6). It holds the
 * match log, so it contains the bot's hidden setup: it is stored, never rendered (PRD I4).
 */
export const SAVE_KEY = 'okiya.saved-match';
export const SAVE_VERSION = 1;

export interface SavedMatch {
  readonly state: MatchState;
  readonly depth: BotDepthId;
}

/** Saves a running match; a finished one is removed instead. Returns false when storage refuses. */
export function saveMatch(storage: KeyValueStorage | null, state: MatchState, depth: BotDepthId): boolean {
  if (state.result) return clearSavedMatch(storage);
  return writeJson(storage, SAVE_KEY, { version: SAVE_VERSION, depth, log: matchLogOf(state) });
}

export function clearSavedMatch(storage: KeyValueStorage | null): boolean {
  return removeKey(storage, SAVE_KEY);
}

/**
 * Reads a saved match from its stored text, or null when it is corrupt, truncated, from another
 * version, for other rules than `spec-v0.2`, refused on replay or already finished. The log is
 * replayed under `spec-v0.2` itself, never under rule values read from storage.
 */
export function restoreSavedMatch(text: string): SavedMatch | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.version !== SAVE_VERSION || !isBotDepth(data.depth)) return null;
    const parsed = parseMatchLog(data.log);
    if (!parsed.ok) return null;
    const { log } = parsed;
    if (log.preset.id !== PRESET.id || log.preset.version !== PRESET.version || log.scenario !== null) return null;
    const replay = replayMatchSteps({ ...log, preset: { id: PRESET.id, version: PRESET.version, values: PRESET } }, TILES);
    if (!replay.ok) return null;
    const state = replay.states[replay.states.length - 1]!;
    return state.result ? null : { state, depth: data.depth };
  } catch {
    // Until `parseMatchLog` is hardened, a malformed log can throw instead of being refused.
    return null;
  }
}

/** The saved match, if one restores; a save that does not is discarded. */
export function loadSavedMatch(storage: KeyValueStorage | null): SavedMatch | null {
  const text = readText(storage, SAVE_KEY);
  if (text === null) return null;
  const saved = restoreSavedMatch(text);
  if (!saved) clearSavedMatch(storage);
  return saved;
}
