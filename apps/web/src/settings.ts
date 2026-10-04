import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from './difficulty';
import { isRecord, readJson, writeJson, type KeyValueStorage } from './storage';

/**
 * The player's settings (PRD E3, E4, S1): legal-take highlights and sound, both on by default, and the
 * difficulty the home screen's switch remembers, Normal at first.
 */
export interface Settings {
  readonly highlights: boolean;
  readonly sound: boolean;
  readonly difficulty: Difficulty;
}

export const SETTINGS_KEY = 'okiya.settings';
export const DEFAULT_SETTINGS: Settings = { highlights: true, sound: true, difficulty: DEFAULT_DIFFICULTY };

/**
 * The remembered settings; a missing or corrupt value falls back to the defaults, field by field, so
 * settings stored before the difficulty switch load with Normal.
 */
export function loadSettings(storage: KeyValueStorage | null): Settings {
  const stored = readJson(storage, SETTINGS_KEY);
  if (!isRecord(stored)) return DEFAULT_SETTINGS;
  return {
    highlights: typeof stored.highlights === 'boolean' ? stored.highlights : DEFAULT_SETTINGS.highlights,
    sound: typeof stored.sound === 'boolean' ? stored.sound : DEFAULT_SETTINGS.sound,
    difficulty: isDifficulty(stored.difficulty) ? stored.difficulty : DEFAULT_SETTINGS.difficulty,
  };
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings);
}
