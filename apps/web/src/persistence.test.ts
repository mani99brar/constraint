import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { applyAction, listLegalActions, matchLogOf, type MatchState } from '@okiya/rules';
import { App } from './App';
import { botStep, createMatch, prepare } from './match';
import { emptyResults, loadResults, outcomeOf, recordResult, resetResults, RESULTS_KEY } from './results';
import { clearSavedMatch, loadSavedMatch, restoreSavedMatch, SAVE_KEY, SAVE_VERSION, saveMatch } from './save';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings';
import { defaultHumanSetup } from './setup';
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

/** A match a few actions in: the human plays its first legal action, the bot replies. */
function playedMatch(): MatchState {
  let state = createMatch(prepare(12), defaultHumanSetup(12, SPEC_V0_2), 77);
  for (let i = 0; i < 6 && !state.result; i += 1) {
    if (state.activePlayer === 'B') state = botStep(state, state.turn, { maxDepth: 1 });
    else {
      const applied = applyAction(state, listLegalActions(state)[0]!);
      if (!applied.ok) throw new Error('refused');
      state = applied.state;
    }
  }
  return state;
}

describe('saved match (PRD E6)', () => {
  const state = playedMatch();

  it('round-trips through storage to the same state and difficulty', () => {
    expect(state.history.length).toBeGreaterThanOrEqual(4);
    const storage = memoryStorage();
    expect(saveMatch(storage, state, 'hard')).toBe(true);
    const saved = loadSavedMatch(storage);
    expect(saved?.depth).toBe('hard');
    expect(saved?.state).toEqual(state);
  });

  it('removes the save once the match is finished, and on request', () => {
    const storage = memoryStorage();
    saveMatch(storage, state, 'easy');
    saveMatch(storage, { ...state, result: { kind: 'draw', reason: 'repetition' } }, 'easy');
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    saveMatch(storage, state, 'easy');
    clearSavedMatch(storage);
    expect(loadSavedMatch(storage)).toBeNull();
  });

  const good = JSON.stringify({ version: SAVE_VERSION, depth: 'normal', log: matchLogOf(state) });
  const log = matchLogOf(state);
  const corrupt: Record<string, string> = {
    'not JSON': '{"version":1,',
    truncated: good.slice(0, Math.floor(good.length / 2)),
    'an unknown save version': JSON.stringify({ version: SAVE_VERSION + 1, depth: 'normal', log }),
    'an unknown log format': JSON.stringify({ version: SAVE_VERSION, depth: 'normal', log: { ...log, formatVersion: 99 } }),
    'an unknown difficulty': JSON.stringify({ version: SAVE_VERSION, depth: 'extreme', log }),
    'other rules': JSON.stringify({ version: SAVE_VERSION, depth: 'normal', log: { ...log, preset: { ...log.preset, id: 'spec-v0.1' } } }),
    'a refused action': JSON.stringify({
      version: SAVE_VERSION,
      depth: 'normal',
      log: { ...log, actions: [...log.actions, { kind: 'move', fighter: 'A:Nobody', cell: 'Z9' }] },
    }),
    'malformed actions': JSON.stringify({ version: SAVE_VERSION, depth: 'normal', log: { ...log, actions: [{ kind: 'deploy' }] } }),
    'a null log': JSON.stringify({ version: SAVE_VERSION, depth: 'normal', log: null }),
    'a bare number': '42',
  };

  it.each(Object.keys(corrupt))('discards a save with %s, without throwing', (name) => {
    const storage = memoryStorage();
    storage.data.set(SAVE_KEY, corrupt[name]!);
    expect(() => restoreSavedMatch(corrupt[name]!)).not.toThrow();
    expect(loadSavedMatch(storage)).toBeNull();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it('keeps the game playable when storage throws', () => {
    expect(saveMatch(throwing, state, 'normal')).toBe(false);
    expect(loadSavedMatch(throwing)).toBeNull();
    expect(clearSavedMatch(throwing)).toBe(false);
    expect(loadSavedMatch(null)).toBeNull();
    const html = renderToStaticMarkup(createElement(App, { storage: throwing }));
    expect(html).toContain('New game');
    expect(html).toContain('How to play');
    expect(html).not.toContain('Continue');
    expect(renderToStaticMarkup(createElement(App, { storage: null }))).toContain('New game');
  });

  it('offers Continue on the title screen when a save restores', () => {
    const storage = memoryStorage();
    saveMatch(storage, state, 'hard');
    const html = renderToStaticMarkup(createElement(App, { storage }));
    expect(html).toContain('data-testid="continue"');
    expect(html).toContain(`Hard bot, turn ${state.turn}`);
  });
});

describe('results by difficulty (PRD E7)', () => {
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

  it('reads the human’s outcome from the result', () => {
    expect(outcomeOf({ kind: 'win', winner: 'A', reason: 'objective' }, 'A')).toBe('win');
    expect(outcomeOf({ kind: 'win', winner: 'B', reason: 'blockade' }, 'A')).toBe('loss');
    expect(outcomeOf({ kind: 'draw', reason: 'repetition' }, 'A')).toBe('draw');
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

describe('settings (PRD E4, E5)', () => {
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
