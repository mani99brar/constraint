import { describe, expect, it } from 'vitest';
import { difficultyAfterKey, homeModel, REPLACES_NOTE } from './home';
import { TWO_PLAYERS, versusBot } from './mode';
import { emptyResults, recordResult } from './results';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

describe('home model (PRD S1, E1, E5)', () => {
  it('offers Continue only for a saved game, with its mode and number of takes, and says starting replaces it', () => {
    const none = homeModel(null, DEFAULT_SETTINGS, emptyResults());
    expect(none.continueGame).toBeNull();
    expect(none.replacesSaved).toBe(false);
    const bot = homeModel({ mode: versusBot('hard'), takes: 7 }, DEFAULT_SETTINGS, emptyResults());
    expect(bot.continueGame).toEqual({ mode: versusBot('hard'), takes: 7, note: 'Hard bot, 7 tiles taken' });
    expect(bot.replacesSaved).toBe(true);
    expect(homeModel({ mode: TWO_PLAYERS, takes: 1 }, DEFAULT_SETTINGS, emptyResults()).continueGame?.note).toBe('Two players, 1 tile taken');
    expect(REPLACES_NOTE).toMatch(/replaces/);
  });

  it('shows the switch at Normal at first, at the remembered difficulty after a change, and at Normal for older settings', () => {
    const storage = memoryStorage();
    expect(homeModel(null, loadSettings(storage), emptyResults()).difficulty).toBe('normal');
    saveSettings(storage, { ...loadSettings(storage), difficulty: 'easy' });
    expect(homeModel(null, loadSettings(storage), emptyResults()).difficulty).toBe('easy');
    saveSettings(storage, { ...loadSettings(storage), difficulty: 'hard' });
    expect(homeModel(null, loadSettings(storage), emptyResults()).difficulty).toBe('hard');
    storage.data.set('okiya.settings', JSON.stringify({ highlights: true, sound: false }));
    expect(homeModel(null, loadSettings(storage), emptyResults()).difficulty).toBe('normal');
  });

  it('gives the results strip for each difficulty, and enables the reset once a bot game was counted', () => {
    const empty = homeModel(null, DEFAULT_SETTINGS, emptyResults());
    expect(empty.results.map((row) => [row.difficulty, row.label, row.wins, row.losses, row.draws])).toEqual([
      ['easy', 'Easy', 0, 0, 0],
      ['normal', 'Normal', 0, 0, 0],
      ['hard', 'Hard', 0, 0, 0],
    ]);
    expect(empty.canReset).toBe(false);
    const storage = memoryStorage();
    recordResult(storage, 'normal', 'win');
    const results = recordResult(storage, 'hard', 'draw');
    const counted = homeModel(null, DEFAULT_SETTINGS, results);
    expect(counted.results.map((row) => [row.wins, row.losses, row.draws])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
    expect(counted.canReset).toBe(true);
  });

  it('moves the switch with the arrow keys as a radio group does, wrapping round', () => {
    expect(difficultyAfterKey('normal', 'ArrowRight')).toBe('hard');
    expect(difficultyAfterKey('hard', 'ArrowDown')).toBe('easy');
    expect(difficultyAfterKey('normal', 'ArrowLeft')).toBe('easy');
    expect(difficultyAfterKey('easy', 'ArrowUp')).toBe('hard');
    expect(difficultyAfterKey('hard', 'Home')).toBe('easy');
    expect(difficultyAfterKey('easy', 'End')).toBe('hard');
    expect(difficultyAfterKey('easy', 'Enter')).toBeNull();
  });
});
