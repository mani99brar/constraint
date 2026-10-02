import { describe, expect, it } from 'vitest';
import { LAST_STARTER_KEY, rememberStarter, starterForNewGame } from './starter';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

describe('who starts a new game (spec §5)', () => {
  it('is random for the very first game', () => {
    expect(starterForNewGame(memoryStorage())).toBeUndefined();
    expect(starterForNewGame(null)).toBeUndefined();
  });

  it('is the other player than in the last game, whichever way the new game starts', () => {
    const storage = memoryStorage();
    rememberStarter(storage, 'A');
    expect(starterForNewGame(storage)).toBe('B');
    rememberStarter(storage, 'B');
    expect(starterForNewGame(storage)).toBe('A');
  });

  it('falls back to random on a corrupt value or throwing storage', () => {
    const storage = memoryStorage();
    for (const value of ['"C"', 'not json', '3']) {
      storage.data.set(LAST_STARTER_KEY, value);
      expect(starterForNewGame(storage)).toBeUndefined();
    }
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(rememberStarter(throwing, 'A')).toBe(false);
    expect(starterForNewGame(throwing)).toBeUndefined();
  });
});
