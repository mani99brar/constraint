import { gameLogOf, parseGameLog, replayGame, type GameState } from '@okiya/game';
import { isDifficulty, type Difficulty } from './difficulty';
import { isRecord, readText, removeKey, writeJson, type KeyValueStorage } from './storage';

/**
 * The unfinished game, saved after every take as its game log and difficulty, and offered as
 * Continue (PRD L2). A save of the fighter game, or anything else that does not replay, is discarded.
 */
export const SAVE_KEY = 'okiya.saved-match';
/** Version 1 held the fighter game's match log; version 2 holds the game log of rules v1.0. */
export const SAVE_VERSION = 2;

export interface SavedGame {
  readonly state: GameState;
  readonly difficulty: Difficulty;
}

/** Saves a running game; a finished one is removed instead. Returns false when storage refuses. */
export function saveGame(storage: KeyValueStorage | null, state: GameState, difficulty: Difficulty): boolean {
  if (state.result) return clearSavedGame(storage);
  return writeJson(storage, SAVE_KEY, { version: SAVE_VERSION, difficulty, log: gameLogOf(state) });
}

export function clearSavedGame(storage: KeyValueStorage | null): boolean {
  return removeKey(storage, SAVE_KEY);
}

/**
 * Reads a saved game from its stored text, or null when it is corrupt, truncated, from another
 * version, refused by `parseGameLog` or `replayGame`, or already finished. Never throws.
 */
export function restoreSavedGame(text: string): SavedGame | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.version !== SAVE_VERSION || !isDifficulty(data.difficulty)) return null;
    const parsed = parseGameLog(data.log);
    if (!parsed.ok) return null;
    const replay = replayGame(parsed.log);
    if (!replay.ok) return null;
    const state = replay.states[replay.states.length - 1]!;
    return state.result ? null : { state, difficulty: data.difficulty };
  } catch {
    return null;
  }
}

/** The saved game, if one restores; a save that does not is discarded. */
export function loadSavedGame(storage: KeyValueStorage | null): SavedGame | null {
  const text = readText(storage, SAVE_KEY);
  if (text === null) return null;
  const saved = restoreSavedGame(text);
  if (!saved) clearSavedGame(storage);
  return saved;
}
