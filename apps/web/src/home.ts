import { DIFFICULTY_OPTIONS, type Difficulty } from './difficulty';
import { modeLabel, type GameMode } from './mode';
import type { Results } from './results';
import type { Settings } from './settings';

/** One difficulty's line in the home screen's results strip (PRD E5). */
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
  /** The difficulty the Versus bot switch shows: the remembered one, Normal at first. */
  readonly difficulty: Difficulty;
  /** Whether starting a game replaces a saved one; the play cards say so. */
  readonly replacesSaved: boolean;
  readonly results: readonly ResultsRow[];
  /** The reset is enabled once a bot game was counted. */
  readonly canReset: boolean;
}

export const REPLACES_NOTE = 'Starting replaces your saved game.';

export function homeModel(saved: { readonly mode: GameMode; readonly takes: number } | null, settings: Settings, results: Results): HomeModel {
  const rows = DIFFICULTY_OPTIONS.map(({ id, label }) => ({ difficulty: id, label, ...results[id] }));
  return {
    continueGame: saved ? { mode: saved.mode, takes: saved.takes, note: `${modeLabel(saved.mode)}, ${saved.takes} ${saved.takes === 1 ? 'tile' : 'tiles'} taken` } : null,
    difficulty: settings.difficulty,
    replacesSaved: saved !== null,
    results: rows,
    canReset: rows.some((row) => row.wins + row.losses + row.draws > 0),
  };
}

/**
 * The difficulty an arrow key moves the switch to, as a radio group does (WAI-ARIA): Right and Down go
 * to the next, Left and Up to the previous, wrapping round; Home and End go to the ends. Null for any other key.
 */
export function difficultyAfterKey(current: Difficulty, key: string): Difficulty | null {
  const ids = DIFFICULTY_OPTIONS.map((option) => option.id);
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
