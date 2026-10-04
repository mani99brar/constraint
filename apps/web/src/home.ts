import { DIFFICULTY_OPTIONS, difficultyLabel, type Difficulty } from './difficulty';
import { modeLabel, TWO_PLAYERS, versusBot, type GameMode } from './mode';
import type { Results } from './results';
import { OPPONENTS, type Opponent, type Settings } from './settings';
import { PALETTE_IDS, type PaletteId } from './theme';

/** One difficulty's wins, losses and draws in the home screen's results line (PRD E5). */
export interface ResultsRow {
  readonly difficulty: Difficulty;
  readonly label: string;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** Everything the home screen shows (PRD S1, E1, E5). */
export interface HomeModel {
  /** Continue, only for a saved game: its mode and number of takes in words. */
  readonly continueGame: { readonly mode: GameMode; readonly takes: number; readonly note: string } | null;
  /** The opponent the play panel's switch shows: the remembered one, the bot at first. */
  readonly opponent: Opponent;
  /** The difficulty the switch shows, offered only while the bot is chosen: the remembered one, Normal at first. */
  readonly difficulty: Difficulty;
  /** Whether the difficulty switch is on the page: only while the bot is chosen. */
  readonly showDifficulty: boolean;
  /** The game Play starts. */
  readonly mode: GameMode;
  /** The one Play button's label: "Play · Normal bot" or "Play · with a friend". */
  readonly playLabel: string;
  /** Whether Play replaces a saved game; the panel says so. */
  readonly replacesSaved: boolean;
  readonly results: readonly ResultsRow[];
  /** The results in one quiet line: "Easy 2–1–0 · Normal 0–0–0 · Hard 0–0–0 (W–L–D)". */
  readonly resultsLine: string;
  /** The same line in words, for screen readers. */
  readonly resultsSpoken: string;
  /** Settings' reset is enabled once a bot game was counted. */
  readonly canReset: boolean;
}

export const REPLACES_NOTE = 'Play replaces your saved game.';

/** The label of the one Play button for a choice (PRD S1). */
export function playLabel(opponent: Opponent, difficulty: Difficulty): string {
  return opponent === 'friend' ? 'Play · with a friend' : `Play · ${difficultyLabel(difficulty)} bot`;
}

/** The results by difficulty in one line, and in words. */
export function resultsLine(rows: readonly ResultsRow[]): { readonly line: string; readonly spoken: string } {
  return {
    line: `${rows.map((row) => `${row.label} ${row.wins}–${row.losses}–${row.draws}`).join(' · ')} (W–L–D)`,
    spoken: `Results against the bot: ${rows.map((row) => `${row.label}, ${row.wins} won, ${row.losses} lost, ${row.draws} drawn`).join('; ')}.`,
  };
}

export function homeModel(saved: { readonly mode: GameMode; readonly takes: number } | null, settings: Settings, results: Results): HomeModel {
  const rows = DIFFICULTY_OPTIONS.map(({ id, label }) => ({ difficulty: id, label, ...results[id] }));
  const { line, spoken } = resultsLine(rows);
  return {
    continueGame: saved ? { mode: saved.mode, takes: saved.takes, note: `${modeLabel(saved.mode)}, ${saved.takes} ${saved.takes === 1 ? 'tile' : 'tiles'} taken` } : null,
    opponent: settings.opponent,
    difficulty: settings.difficulty,
    showDifficulty: settings.opponent === 'bot',
    mode: settings.opponent === 'bot' ? versusBot(settings.difficulty) : TWO_PLAYERS,
    playLabel: playLabel(settings.opponent, settings.difficulty),
    replacesSaved: saved !== null,
    results: rows,
    resultsLine: line,
    resultsSpoken: spoken,
    canReset: rows.some((row) => row.wins + row.losses + row.draws > 0),
  };
}

/**
 * The option an arrow key moves a radio group to (WAI-ARIA): Right and Down go to the next, Left and Up
 * to the previous, wrapping round; Home and End go to the ends. Null for any other key.
 */
export function optionAfterKey<T>(ids: readonly T[], current: T, key: string): T | null {
  const index = ids.indexOf(current);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return ids[(index + 1) % ids.length]!;
    case 'ArrowLeft':
    case 'ArrowUp':
      return ids[(index + ids.length - 1) % ids.length]!;
    case 'Home':
      return ids[0]!;
    case 'End':
      return ids[ids.length - 1]!;
    default:
      return null;
  }
}

/** The difficulty an arrow key moves the difficulty switch to. */
export function difficultyAfterKey(current: Difficulty, key: string): Difficulty | null {
  return optionAfterKey(
    DIFFICULTY_OPTIONS.map((option) => option.id),
    current,
    key,
  );
}

/** The opponent an arrow key moves the Opponent switch to. */
export function opponentAfterKey(current: Opponent, key: string): Opponent | null {
  return optionAfterKey(
    OPPONENTS.map((option) => option.id),
    current,
    key,
  );
}

/** The colour theme an arrow key moves the menu's Theme switch to. */
export function paletteAfterKey(current: PaletteId, key: string): PaletteId | null {
  return optionAfterKey(PALETTE_IDS, current, key);
}
