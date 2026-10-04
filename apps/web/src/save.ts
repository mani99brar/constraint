import { gameLogOf, parseGameLog, replayGame, type GameState } from '@okiya/game';
import { isDifficulty } from './difficulty';
import { TWO_PLAYERS, versusBot, type GameMode } from './mode';
import { isScore, NO_SCORE, type Score } from './score';
import { isRecord, readText, removeKey, writeJson, type KeyValueStorage } from './storage';

/**
 * The unfinished game, saved after every take as its game log, its mode, the difficulty in a bot game
 * and the score of the sitting, and offered as Continue (PRD L2). Anything that does not replay is discarded.
 */
export const SAVE_KEY = 'okiya.saved-match';
/** Version 1 held the fighter game's match log, version 2 a game log and a difficulty, version 3 adds the mode and the score. */
export const SAVE_VERSION = 3;
/** The save of v1.0 of the product, still restored as a bot game with a new score. */
const BOT_ONLY_VERSION = 2;

export interface SavedGame {
  readonly state: GameState;
  readonly mode: GameMode;
  readonly score: Score;
}

/** Saves a running game; a finished one is removed instead. Returns false when storage refuses. */
export function saveGame(storage: KeyValueStorage | null, state: GameState, mode: GameMode, score: Score): boolean {
  if (state.result) return clearSavedGame(storage);
  const difficulty = mode.kind === 'bot' ? { difficulty: mode.difficulty } : {};
  return writeJson(storage, SAVE_KEY, { version: SAVE_VERSION, mode: mode.kind, ...difficulty, score, log: gameLogOf(state) });
}

export function clearSavedGame(storage: KeyValueStorage | null): boolean {
  return removeKey(storage, SAVE_KEY);
}

/** The mode and score of stored data, or null when either is missing or malformed. */
function modeAndScore(data: Record<string, unknown>): { mode: GameMode; score: Score } | null {
  if (data.version === BOT_ONLY_VERSION) return isDifficulty(data.difficulty) ? { mode: versusBot(data.difficulty), score: NO_SCORE } : null;
  if (data.version !== SAVE_VERSION || !isScore(data.score)) return null;
  const score: Score = { A: data.score.A, B: data.score.B, draws: data.score.draws };
  if (data.mode === 'two-player') return { mode: TWO_PLAYERS, score };
  if (data.mode === 'bot' && isDifficulty(data.difficulty)) return { mode: versusBot(data.difficulty), score };
  return null;
}

/**
 * Reads a saved game from its stored text, or null when it is corrupt, truncated, from another
 * version, refused by `parseGameLog` or `replayGame`, or already finished. Never throws.
 */
export function restoreSavedGame(text: string): SavedGame | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data)) return null;
    const meta = modeAndScore(data);
    if (!meta) return null;
    const parsed = parseGameLog(data.log);
    if (!parsed.ok) return null;
    const replay = replayGame(parsed.log);
    if (!replay.ok) return null;
    const state = replay.states[replay.states.length - 1]!;
    return state.result ? null : { state, ...meta };
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
