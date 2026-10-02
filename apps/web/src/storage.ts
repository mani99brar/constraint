/**
 * Browser storage for the settings, the saved game and the results (PRD E3–E5, L2). Every read and
 * write is wrapped, so private modes, full quotas and blocked storage leave the game playable.
 */

/** The part of `Storage` the game uses. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's `localStorage`, or null where reading it throws or there is none. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored text, or null when it is missing or storage throws. */
export function readText(storage: KeyValueStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The stored JSON value, or undefined when it is missing, corrupt or storage throws. */
export function readJson(storage: KeyValueStorage | null, key: string): unknown {
  const text = readText(storage, key);
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Stores a value as JSON; returns false when storage refuses, and the game carries on. */
export function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(storage: KeyValueStorage | null, key: string): boolean {
  try {
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
