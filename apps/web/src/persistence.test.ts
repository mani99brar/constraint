import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gameLogOf } from '@okiya/game';
import { App } from './App';
import { afterTakes, endings } from './playouts.test-helper';
import { emptyResults, loadResults, outcomeOf, recordResult, resetResults, RESULTS_KEY } from './results';
import { clearSavedGame, loadSavedGame, restoreSavedGame, SAVE_KEY, SAVE_VERSION, saveGame } from './save';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('saved game (PRD L2)', () => {
  const state = afterTakes(12, 5);

  it('round-trips through storage as its game log and difficulty, to the same state', () => {
    expect(state.takes).toHaveLength(5);
    const storage = memoryStorage();
    expect(saveGame(storage, state, 'hard')).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY)!)).toEqual({ version: SAVE_VERSION, difficulty: 'hard', log: gameLogOf(state) });
    const saved = loadSavedGame(storage);
    expect(saved?.difficulty).toBe('hard');
    expect(saved?.state).toEqual(state);
  });

  it('round-trips a game before its first take, whoever starts', () => {
    for (const starter of ['A', 'B'] as const) {
      const fresh = afterTakes(3, 0, starter);
      const storage = memoryStorage();
      saveGame(storage, fresh, 'easy');
      expect(loadSavedGame(storage)?.state).toEqual(fresh);
    }
  });

  it('removes the save once the game is finished, and on request', () => {
    const storage = memoryStorage();
    saveGame(storage, state, 'easy');
    saveGame(storage, endings().blockade, 'easy');
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    saveGame(storage, state, 'easy');
    clearSavedGame(storage);
    expect(loadSavedGame(storage)).toBeNull();
  });

  const log = gameLogOf(state);
  const good = JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log });
  const finished = endings().line;
  const corrupt: Record<string, string> = {
    'not JSON': '{"version":2,',
    truncated: good.slice(0, Math.floor(good.length / 2)),
    'an unknown save version': JSON.stringify({ version: SAVE_VERSION + 1, difficulty: 'normal', log }),
    'a fighter-game save': JSON.stringify({
      version: 1,
      depth: 'normal',
      log: { formatVersion: 1, seed: 7, preset: { id: 'spec-v0.2', version: 1 }, scenario: null, setups: {}, actions: [{ kind: 'deploy', fighter: 'A:Pusher', cell: 'A1' }] },
    }),
    'an unknown log format': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, formatVersion: 99 } }),
    'an unknown difficulty': JSON.stringify({ version: SAVE_VERSION, difficulty: 'extreme', log }),
    'an illegal take': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, takes: [...log.takes, log.takes[0]] } }),
    'a cell that does not exist': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, takes: ['Z9'] } }),
    'an inner opening take': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, takes: ['B2'] } }),
    'a bad seed': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, seed: -1 } }),
    'a bad starter': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: { ...log, starter: 'C' } }),
    'a finished game': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: gameLogOf(finished) }),
    'a null log': JSON.stringify({ version: SAVE_VERSION, difficulty: 'normal', log: null }),
    'a bare number': '42',
    'null': 'null',
  };

  it.each(Object.keys(corrupt))('discards a save with %s, without throwing', (name) => {
    const storage = memoryStorage();
    storage.data.set(SAVE_KEY, corrupt[name]!);
    expect(() => restoreSavedGame(corrupt[name]!)).not.toThrow();
    expect(restoreSavedGame(corrupt[name]!)).toBeNull();
    expect(loadSavedGame(storage)).toBeNull();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it('keeps the game playable when storage throws', () => {
    expect(saveGame(throwing, state, 'normal')).toBe(false);
    expect(loadSavedGame(throwing)).toBeNull();
    expect(clearSavedGame(throwing)).toBe(false);
    expect(loadSavedGame(null)).toBeNull();
    const html = renderToStaticMarkup(createElement(App, { storage: throwing }));
    expect(html).toContain('New game');
    expect(html).toContain('How to play');
    expect(html).not.toContain('Continue');
    expect(renderToStaticMarkup(createElement(App, { storage: null }))).toContain('New game');
  });

  it('offers Continue on the title screen when a save restores', () => {
    const storage = memoryStorage();
    saveGame(storage, state, 'hard');
    const html = renderToStaticMarkup(createElement(App, { storage }));
    expect(html).toContain('data-testid="continue"');
    expect(html).toContain('Hard bot, 5 tiles taken');
  });
});

describe('results by difficulty (PRD E5)', () => {
  it('counts wins, losses and draws per difficulty, and resets to zero', () => {
    const storage = memoryStorage();
    expect(loadResults(storage)).toEqual(emptyResults());
    recordResult(storage, 'easy', 'win');
    recordResult(storage, 'easy', 'win');
    recordResult(storage, 'easy', 'loss');
    recordResult(storage, 'hard', 'draw');
    expect(loadResults(storage)).toEqual({
      easy: { wins: 2, losses: 1, draws: 0 },
      normal: { wins: 0, losses: 0, draws: 0 },
      hard: { wins: 0, losses: 0, draws: 1 },
    });
    expect(resetResults(storage)).toEqual(emptyResults());
    expect(loadResults(storage)).toEqual(emptyResults());
  });

  it('keeps the counts stored before rules v1.0', () => {
    const storage = memoryStorage();
    storage.data.set(RESULTS_KEY, JSON.stringify({ easy: { wins: 3, losses: 1, draws: 0 }, normal: { wins: 0, losses: 2, draws: 1 }, hard: { wins: 0, losses: 4, draws: 0 } }));
    expect(recordResult(storage, 'normal', 'draw').normal).toEqual({ wins: 0, losses: 2, draws: 2 });
    expect(loadResults(storage).easy).toEqual({ wins: 3, losses: 1, draws: 0 });
  });

  it('reads the human’s outcome from the result', () => {
    expect(outcomeOf({ kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'A2', 'A3', 'A4'] }, 'A')).toBe('win');
    expect(outcomeOf({ kind: 'win', winner: 'B', by: 'blockade' }, 'A')).toBe('loss');
    expect(outcomeOf({ kind: 'draw', by: 'full-board' }, 'A')).toBe('draw');
  });

  it('treats corrupt results as zero and survives storage that throws', () => {
    const storage = memoryStorage();
    storage.data.set(RESULTS_KEY, '{"easy":{"wins":-3,"losses":"x"},"normal":7');
    expect(loadResults(storage)).toEqual(emptyResults());
    storage.data.set(RESULTS_KEY, '{"easy":{"wins":-3,"losses":"x","draws":2}}');
    expect(loadResults(storage).easy).toEqual({ wins: 0, losses: 0, draws: 2 });
    expect(() => recordResult(throwing, 'normal', 'win')).not.toThrow();
    expect(recordResult(throwing, 'normal', 'win').normal.wins).toBe(1);
    expect(loadResults(throwing)).toEqual(emptyResults());
  });
});

describe('settings (PRD E3, E4)', () => {
  it('defaults to highlights and sound on, and remembers changes', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual({ highlights: true, sound: true });
    saveSettings(storage, { highlights: false, sound: false });
    expect(loadSettings(storage)).toEqual({ highlights: false, sound: false });
  });

  it('falls back to the defaults for corrupt values and storage that throws', () => {
    const storage = memoryStorage();
    storage.data.set(SETTINGS_KEY, '{"highlights":"no"');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.data.set(SETTINGS_KEY, '{"highlights":false,"sound":"loud"}');
    expect(loadSettings(storage)).toEqual({ highlights: false, sound: true });
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false);
  });
});
