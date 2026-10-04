import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from './difficulty';
import { isRecord, readJson, writeJson, type KeyValueStorage } from './storage';

/** Who the home screen's play panel sets you against (PRD S1): the bot, or a friend on this device. */
export type Opponent = 'bot' | 'friend';

export const OPPONENTS: readonly { readonly id: Opponent; readonly label: string }[] = [
  { id: 'bot', label: 'Bot' },
  { id: 'friend', label: 'Friend' },
];

export function isOpponent(value: unknown): value is Opponent {
  return value === 'bot' || value === 'friend';
}

/**
 * The player's settings (PRD E3, E4, S1): legal-take highlights and sound, both on by default, tile names
 * on every tile, off by default, and the opponent and difficulty the home screen's play panel remembers,
 * the Normal bot at first.
 */
export interface Settings {
  readonly highlights: boolean;
  readonly sound: boolean;
  readonly tileNames: boolean;
  readonly opponent: Opponent;
  readonly difficulty: Difficulty;
}

export const SETTINGS_KEY = 'okiya.settings';
export const DEFAULT_SETTINGS: Settings = { highlights: true, sound: true, tileNames: false, opponent: 'bot', difficulty: DEFAULT_DIFFICULTY };

/**
 * The remembered settings; a missing or corrupt value falls back to the defaults, field by field, so
 * settings stored by older builds load as the Normal bot with tile names off.
 */
export function loadSettings(storage: KeyValueStorage | null): Settings {
  const stored = readJson(storage, SETTINGS_KEY);
  if (!isRecord(stored)) return DEFAULT_SETTINGS;
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  return {
    highlights: flag(stored.highlights, DEFAULT_SETTINGS.highlights),
    sound: flag(stored.sound, DEFAULT_SETTINGS.sound),
    tileNames: flag(stored.tileNames, DEFAULT_SETTINGS.tileNames),
    opponent: isOpponent(stored.opponent) ? stored.opponent : DEFAULT_SETTINGS.opponent,
    difficulty: isDifficulty(stored.difficulty) ? stored.difficulty : DEFAULT_SETTINGS.difficulty,
  };
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings);
}
