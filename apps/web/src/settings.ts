import { isRecord, readJson, writeJson, type KeyValueStorage } from './storage';

/** The player's settings (PRD E4, E5): legal-move highlights and sound, both on by default. */
export interface Settings {
  readonly highlights: boolean;
  readonly sound: boolean;
}

export const SETTINGS_KEY = 'okiya.settings';
export const DEFAULT_SETTINGS: Settings = { highlights: true, sound: true };

/** The remembered settings; a missing or corrupt value falls back to the defaults, field by field. */
export function loadSettings(storage: KeyValueStorage | null): Settings {
  const stored = readJson(storage, SETTINGS_KEY);
  if (!isRecord(stored)) return DEFAULT_SETTINGS;
  return {
    highlights: typeof stored.highlights === 'boolean' ? stored.highlights : DEFAULT_SETTINGS.highlights,
    sound: typeof stored.sound === 'boolean' ? stored.sound : DEFAULT_SETTINGS.sound,
  };
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings);
}
