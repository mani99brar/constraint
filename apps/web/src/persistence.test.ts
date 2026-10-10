import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gameLogOf } from '@okiya/game';
import { App } from './App';
import { afterTakes, endings } from './playouts.test-helper';
import { TWO_PLAYERS, versusBot } from './mode';
import { emptyResults, loadResults, outcomeOf, recordFinishedGame, recordResult, resetResults, RESULTS_KEY } from './results';
import { clearSavedGame, loadSavedGame, restoreSavedGame, SAVE_KEY, SAVE_VERSION, saveGame } from './save';
import { NO_SCORE } from './score';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings';
import { HOWTO_SEEN_KEY } from './howto';
import { LAST_STARTER_KEY } from './starter';
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
  const hard = versusBot('hard');
  const score = { A: 2, B: 1, draws: 1 };

  it('round-trips a bot game through storage as its game log, mode, difficulty and score, to the same state', () => {
    expect(state.takes).toHaveLength(5);
    const storage = memoryStorage();
    expect(saveGame(storage, state, hard, score)).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY)!)).toEqual({ version: SAVE_VERSION, mode: 'bot', difficulty: 'hard', score, log: gameLogOf(state) });
    const saved = loadSavedGame(storage);
    expect(saved?.mode).toEqual(hard);
    expect(saved?.score).toEqual(score);
    expect(saved?.state).toEqual(state);
  });

  it('round-trips a two-player game with its mode and score, and no difficulty', () => {
    const storage = memoryStorage();
    expect(saveGame(storage, state, TWO_PLAYERS, { A: 0, B: 3, draws: 0 })).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY)!)).toEqual({ version: SAVE_VERSION, mode: 'two-player', score: { A: 0, B: 3, draws: 0 }, log: gameLogOf(state) });
    const saved = loadSavedGame(storage);
    expect(saved).toEqual({ state, mode: TWO_PLAYERS, score: { A: 0, B: 3, draws: 0 }, clockLeft: null });
  });

  it('loads a save of the previous build (a game log and a difficulty) as a bot game with a 0–0 score', () => {
    const storage = memoryStorage();
    // Written under the literal key the previous build used, not this build's constant.
    storage.data.set('okiya.saved-match', JSON.stringify({ version: 2, difficulty: 'normal', log: gameLogOf(state) }));
    expect(loadSavedGame(storage)).toEqual({ state, mode: versusBot('normal'), score: NO_SCORE, clockLeft: null });
  });

  it('round-trips a game before its first take, whoever starts', () => {
    for (const starter of ['A', 'B'] as const) {
      const fresh = afterTakes(3, 0, starter);
      for (const mode of [versusBot('easy'), TWO_PLAYERS]) {
        const storage = memoryStorage();
        saveGame(storage, fresh, mode, NO_SCORE);
        expect(loadSavedGame(storage)?.state).toEqual(fresh);
      }
    }
  });

  it('removes the save once the game is finished, and on request', () => {
    const storage = memoryStorage();
    saveGame(storage, state, versusBot('easy'), NO_SCORE);
    saveGame(storage, endings().blockade, versusBot('easy'), NO_SCORE);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    saveGame(storage, state, TWO_PLAYERS, score);
    clearSavedGame(storage);
    expect(loadSavedGame(storage)).toBeNull();
  });

  const log = gameLogOf(state);
  const v3 = (fields: Record<string, unknown>) => JSON.stringify({ version: SAVE_VERSION, mode: 'bot', difficulty: 'normal', score: NO_SCORE, log, ...fields });
  const good = v3({});
  const finished = endings().line;
  const corrupt: Record<string, string> = {
    'not JSON': '{"version":2,',
    truncated: good.slice(0, Math.floor(good.length / 2)),
    'an unknown save version': v3({ version: SAVE_VERSION + 1 }),
    'an unknown mode': v3({ mode: 'online' }),
    'a bot game without a difficulty': v3({ difficulty: undefined }),
    'a missing score': v3({ score: undefined }),
    'a negative score': v3({ score: { A: -1, B: 0, draws: 0 } }),
    'a score that is not a number': v3({ score: { A: 'one', B: 0, draws: 0 } }),
    'a previous-build save with an unknown difficulty': JSON.stringify({ version: 2, difficulty: 'extreme', log }),
    'a previous-build save with an illegal take': JSON.stringify({ version: 2, difficulty: 'normal', log: { ...log, takes: ['B2'] } }),
    'a fighter-game save': JSON.stringify({
      version: 1,
      depth: 'normal',
      log: { formatVersion: 1, seed: 7, preset: { id: 'spec-v0.2', version: 1 }, scenario: null, setups: {}, actions: [{ kind: 'deploy', fighter: 'A:Pusher', cell: 'A1' }] },
    }),
    'an unknown log format': v3({ log: { ...log, formatVersion: 99 } }),
    'an unknown difficulty': v3({ difficulty: 'extreme' }),
    'an illegal take': v3({ mode: 'two-player', log: { ...log, takes: [...log.takes, log.takes[0]] } }),
    'a cell that does not exist': v3({ log: { ...log, takes: ['Z9'] } }),
    'an inner opening take': v3({ mode: 'two-player', log: { ...log, takes: ['B2'] } }),
    'a bad seed': v3({ log: { ...log, seed: -1 } }),
    'a bad starter': v3({ log: { ...log, starter: 'C' } }),
    'a finished game': v3({ log: gameLogOf(finished) }),
    'a null log': v3({ log: null }),
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
    expect(saveGame(throwing, state, versusBot('normal'), NO_SCORE)).toBe(false);
    expect(loadSavedGame(throwing)).toBeNull();
    expect(clearSavedGame(throwing)).toBe(false);
    expect(loadSavedGame(null)).toBeNull();
    const html = renderToStaticMarkup(createElement(App, { storage: throwing }));
    expect(html).toContain('data-testid="play"');
    expect(html).toContain('Play · Normal bot');
    expect(html).toContain('How to play');
    expect(html).not.toContain('Continue');
    expect(renderToStaticMarkup(createElement(App, { storage: null }))).toContain('data-testid="play"');
  });

  it('offers Continue on the home screen when a save restores', () => {
    const storage = memoryStorage();
    saveGame(storage, state, versusBot('hard'), NO_SCORE);
    const html = renderToStaticMarkup(createElement(App, { storage }));
    expect(html).toContain('data-testid="continue"');
    expect(html).toContain('Hard bot, 5 tiles taken');
    saveGame(storage, state, TWO_PLAYERS, NO_SCORE);
    expect(renderToStaticMarkup(createElement(App, { storage }))).toContain('Two players, 5 tiles taken');
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

  it('counts a finished bot game in its difficulty and never a two-player game', () => {
    const storage = memoryStorage();
    for (const state of Object.values(endings())) {
      const before = loadResults(storage);
      expect(recordFinishedGame(storage, TWO_PLAYERS, state.result!, 'A')).toEqual(before);
      expect(loadResults(storage)).toEqual(before);
      const after = recordFinishedGame(storage, versusBot('normal'), state.result!, 'A');
      const outcome = outcomeOf(state.result!, 'A');
      const key = outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws';
      expect(after.normal[key]).toBe(before.normal[key] + 1);
      expect(after.easy).toEqual(before.easy);
      expect(loadResults(storage)).toEqual(after);
    }
    expect(storage.data.has(RESULTS_KEY)).toBe(true);
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

describe('settings (PRD E3, E4, S1)', () => {
  const all = { highlights: false, sound: false, tileNames: true, opponent: 'friend', difficulty: 'hard', palette: 'seaglass', clockA: '5', clockB: '1', countdown: false, haptics: false, backdrop: false, sceneMotion: false } as const;

  it('defaults to highlights and sound on, tile names off, the Normal bot and the Walnut theme, and remembers changes', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual({ highlights: true, sound: true, tileNames: false, opponent: 'bot', difficulty: 'normal', palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    expect(DEFAULT_SETTINGS).toEqual({ highlights: true, sound: true, tileNames: false, opponent: 'bot', difficulty: 'normal', palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    saveSettings(storage, all);
    expect(JSON.parse(storage.data.get('okiya.settings')!)).toEqual(all);
    expect(loadSettings(storage)).toEqual(all);
    saveSettings(storage, { highlights: true, sound: false, tileNames: false, opponent: 'bot', difficulty: 'easy', palette: 'clear', clockA: 'off', clockB: '3', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    expect(loadSettings(storage)).toEqual({ highlights: true, sound: false, tileNames: false, opponent: 'bot', difficulty: 'easy', palette: 'clear', clockA: 'off', clockB: '3', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
  });

  it('round-trips the opponent, the difficulty, the Tile names setting and the colour theme one by one', () => {
    const storage = memoryStorage();
    for (const opponent of ['friend', 'bot'] as const) {
      saveSettings(storage, { ...loadSettings(storage), opponent });
      expect(loadSettings(storage).opponent).toBe(opponent);
    }
    for (const difficulty of ['easy', 'hard', 'normal'] as const) {
      saveSettings(storage, { ...loadSettings(storage), difficulty });
      expect(loadSettings(storage).difficulty).toBe(difficulty);
    }
    for (const tileNames of [true, false]) {
      saveSettings(storage, { ...loadSettings(storage), tileNames });
      expect(loadSettings(storage).tileNames).toBe(tileNames);
    }
    for (const palette of ['seaglass', 'clear', 'walnut'] as const) {
      saveSettings(storage, { ...loadSettings(storage), palette });
      expect(JSON.parse(storage.data.get('okiya.settings')!).palette).toBe(palette);
      expect(loadSettings(storage).palette).toBe(palette);
    }
  });

  it('loads settings stored by older builds as the Normal bot with tile names off and the Walnut theme, and unknown values as the defaults', () => {
    const storage = memoryStorage();
    // Written under the literal key the previous builds used: before the difficulty switch, and with it.
    storage.data.set('okiya.settings', JSON.stringify({ highlights: false, sound: true }));
    expect(loadSettings(storage)).toEqual({ highlights: false, sound: true, tileNames: false, opponent: 'bot', difficulty: 'normal', palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    storage.data.set('okiya.settings', JSON.stringify({ highlights: true, sound: false, difficulty: 'hard' }));
    expect(loadSettings(storage)).toEqual({ highlights: true, sound: false, tileNames: false, opponent: 'bot', difficulty: 'hard', palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    // The calm-table build's settings, with the opponent and tile names but no theme.
    storage.data.set('okiya.settings', JSON.stringify({ highlights: true, sound: true, tileNames: true, opponent: 'friend', difficulty: 'easy' }));
    expect(loadSettings(storage)).toEqual({ highlights: true, sound: true, tileNames: true, opponent: 'friend', difficulty: 'easy', palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
    storage.data.set('okiya.settings', JSON.stringify({ highlights: true, sound: true, difficulty: 'extreme', opponent: 'cat', tileNames: 'yes', palette: 'teal', clockA: '6', clockB: 3 }));
    expect(loadSettings(storage)).toMatchObject({ difficulty: 'normal', opponent: 'bot', tileNames: false, palette: 'night-circuit', clockA: 'off', clockB: 'off', countdown: true, haptics: true, backdrop: true, sceneMotion: true });
  });

  it('falls back to the defaults for corrupt values and storage that throws', () => {
    const storage = memoryStorage();
    storage.data.set(SETTINGS_KEY, '{"highlights":"no"');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.data.set(SETTINGS_KEY, '{"highlights":false,"sound":"loud"}');
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, highlights: false });
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('storage keys', () => {
  it('keeps the keys the published builds use, so saved games, results and settings carry over', () => {
    expect(SAVE_KEY).toBe('okiya.saved-match');
    expect(RESULTS_KEY).toBe('okiya.results');
    expect(SETTINGS_KEY).toBe('okiya.settings');
    expect(LAST_STARTER_KEY).toBe('okiya.last-starter');
    expect(HOWTO_SEEN_KEY).toBe('okiya.howto.seen');
  });

  it('reads the results a published build wrote under its literal key', () => {
    const storage = memoryStorage();
    const written = recordResult(memoryStorage(), 'hard', 'win');
    storage.data.set('okiya.results', JSON.stringify(written));
    expect(loadResults(storage)).toEqual(written);
  });
});
