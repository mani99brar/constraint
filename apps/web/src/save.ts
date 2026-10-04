import { gameLogOf, parseGameLog, replayGame, type GameState } from '@okiya/game';
import { isClockTimes, type ClockTimes } from './clock';
import { isDifficulty } from './difficulty';
import { clockOf, TWO_PLAYERS, twoPlayers, versusBot, type GameMode } from './mode';
import { isScore, NO_SCORE, type Score } from './score';
import { isRecord, readText, removeKey, writeJson, type KeyValueStorage } from './storage';

/**
 * The unfinished game, saved after every take as its game log, its mode, the difficulty in a bot game
 * and the score of the sitting, and offered as Continue (PRD L2). A timed two-player game also keeps its
 * starting times and each player's time left, so Continue restores the clocks where they stopped.
 * Anything that does not replay is discarded.
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
  /** A timed game's time left for each player when it was saved; null for an untimed game. */
  readonly clockLeft: ClockTimes | null;
}

/**
 * Saves a running game; a finished one is removed instead. A timed game stores its starting times and the
 * time left (`clockLeft`, its starting times when not given). Returns false when storage refuses.
 */
export function saveGame(storage: KeyValueStorage | null, state: GameState, mode: GameMode, score: Score, clockLeft: ClockTimes | null = null): boolean {
  if (state.result) return clearSavedGame(storage);
  const difficulty = mode.kind === 'bot' ? { difficulty: mode.difficulty } : {};
  const start = clockOf(mode);
  const clock = start ? { clock: { start, left: clockLeft ?? start } } : {};
  return writeJson(storage, SAVE_KEY, { version: SAVE_VERSION, mode: mode.kind, ...difficulty, score, ...clock, log: gameLogOf(state) });
}

export function clearSavedGame(storage: KeyValueStorage | null): boolean {
  return removeKey(storage, SAVE_KEY);
}

/** The mode, score and clocks of stored data, or null when any is missing or malformed. */
function modeAndScore(data: Record<string, unknown>): { mode: GameMode; score: Score; clockLeft: ClockTimes | null } | null {
  if (data.version === BOT_ONLY_VERSION) return isDifficulty(data.difficulty) ? { mode: versusBot(data.difficulty), score: NO_SCORE, clockLeft: null } : null;
  if (data.version !== SAVE_VERSION || !isScore(data.score)) return null;
  const score: Score = { A: data.score.A, B: data.score.B, draws: data.score.draws };
  if (data.mode === 'two-player') {
    if (data.clock === undefined) return { mode: TWO_PLAYERS, score, clockLeft: null };
    const clock = isRecord(data.clock) ? data.clock : null;
    if (!clock || !isClockTimes(clock.start) || !isClockTimes(clock.left)) return null;
    // A player without a clock at the start has none left; a time left never exceeds the start.
    const { start, left } = clock;
    const fits = (['A', 'B'] as const).every((player) => (start[player] === null ? left[player] === null : left[player] !== null && left[player]! <= start[player]!));
    if (!fits) return null;
    return { mode: twoPlayers(start), score, clockLeft: { A: left.A, B: left.B } };
  }
  if (data.mode === 'bot' && isDifficulty(data.difficulty)) return { mode: versusBot(data.difficulty), score, clockLeft: null };
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
