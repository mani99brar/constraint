import { describe, expect, it } from 'vitest';
import { difficultyAfterKey, homeModel, opponentAfterKey, playLabel, REPLACES_NOTE, resultsLine } from './home';
import { TWO_PLAYERS, versusBot } from './mode';
import { emptyResults, recordResult } from './results';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

describe('home model (PRD S1, E1, E5)', () => {
  it('offers Continue only for a saved game, with its mode and number of takes, and says Play replaces it', () => {
    const none = homeModel(null, DEFAULT_SETTINGS, emptyResults());
    expect(none.continueGame).toBeNull();
    expect(none.replacesSaved).toBe(false);
    const bot = homeModel({ mode: versusBot('hard'), takes: 7 }, DEFAULT_SETTINGS, emptyResults());
    expect(bot.continueGame).toEqual({ mode: versusBot('hard'), takes: 7, note: 'Hard bot, 7 tiles taken' });
    expect(bot.replacesSaved).toBe(true);
    expect(homeModel({ mode: TWO_PLAYERS, takes: 1 }, DEFAULT_SETTINGS, emptyResults()).continueGame?.note).toBe('Two players, 1 tile taken');
    expect(REPLACES_NOTE).toBe('Play replaces your saved game.');
  });

  it('labels the one Play button with the choice, for each opponent and difficulty', () => {
    expect(playLabel('bot', 'easy')).toBe('Play · Easy bot');
    expect(playLabel('bot', 'normal')).toBe('Play · Normal bot');
    expect(playLabel('bot', 'hard')).toBe('Play · Hard bot');
    for (const difficulty of ['easy', 'normal', 'hard'] as const) expect(playLabel('friend', difficulty)).toBe('Play · with a friend');
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const bot = homeModel(null, { ...DEFAULT_SETTINGS, opponent: 'bot', difficulty }, emptyResults());
      expect(bot.playLabel).toBe(playLabel('bot', difficulty));
      expect(bot.mode).toEqual(versusBot(difficulty));
      expect(bot.showDifficulty).toBe(true);
      const friend = homeModel(null, { ...DEFAULT_SETTINGS, opponent: 'friend', difficulty }, emptyResults());
      expect(friend.playLabel).toBe('Play · with a friend');
      expect(friend.mode).toEqual(TWO_PLAYERS);
      // The difficulty switch leaves the page while a friend is chosen, and the difficulty is kept for later.
      expect(friend.showDifficulty).toBe(false);
      expect(friend.difficulty).toBe(difficulty);
    }
  });

  it('shows the Normal bot at first, the remembered choice after a change, and the Normal bot for older settings', () => {
    const storage = memoryStorage();
    const model = () => homeModel(null, loadSettings(storage), emptyResults());
    expect(model()).toMatchObject({ opponent: 'bot', difficulty: 'normal', playLabel: 'Play · Normal bot' });
    saveSettings(storage, { ...loadSettings(storage), difficulty: 'easy' });
    expect(model()).toMatchObject({ opponent: 'bot', difficulty: 'easy', playLabel: 'Play · Easy bot' });
    saveSettings(storage, { ...loadSettings(storage), opponent: 'friend' });
    expect(model()).toMatchObject({ opponent: 'friend', difficulty: 'easy', playLabel: 'Play · with a friend' });
    storage.data.set('okiya.settings', JSON.stringify({ highlights: true, sound: false }));
    expect(model()).toMatchObject({ opponent: 'bot', difficulty: 'normal' });
  });

  it('gives the results in one quiet line, and enables the reset once a bot game was counted', () => {
    const empty = homeModel(null, DEFAULT_SETTINGS, emptyResults());
    expect(empty.results.map((row) => [row.difficulty, row.label, row.wins, row.losses, row.draws])).toEqual([
      ['easy', 'Easy', 0, 0, 0],
      ['normal', 'Normal', 0, 0, 0],
      ['hard', 'Hard', 0, 0, 0],
    ]);
    expect(empty.resultsLine).toBe('Easy 0–0–0 · Normal 0–0–0 · Hard 0–0–0 (W–L–D)');
    expect(empty.canReset).toBe(false);
    const storage = memoryStorage();
    recordResult(storage, 'normal', 'win');
    recordResult(storage, 'normal', 'loss');
    const results = recordResult(storage, 'hard', 'draw');
    const counted = homeModel(null, DEFAULT_SETTINGS, results);
    expect(counted.resultsLine).toBe('Easy 0–0–0 · Normal 1–1–0 · Hard 0–0–1 (W–L–D)');
    expect(counted.resultsSpoken).toBe('Results against the bot: Easy, 0 won, 0 lost, 0 drawn; Normal, 1 won, 1 lost, 0 drawn; Hard, 0 won, 0 lost, 1 drawn.');
    expect(counted.resultsLine).not.toContain('\n');
    expect(resultsLine(counted.results).line).toBe(counted.resultsLine);
    expect(counted.canReset).toBe(true);
  });

  it('moves both switches with the arrow keys as a radio group does, wrapping round', () => {
    expect(difficultyAfterKey('normal', 'ArrowRight')).toBe('hard');
    expect(difficultyAfterKey('hard', 'ArrowDown')).toBe('easy');
    expect(difficultyAfterKey('normal', 'ArrowLeft')).toBe('easy');
    expect(difficultyAfterKey('easy', 'ArrowUp')).toBe('hard');
    expect(difficultyAfterKey('hard', 'Home')).toBe('easy');
    expect(difficultyAfterKey('easy', 'End')).toBe('hard');
    expect(difficultyAfterKey('easy', 'Enter')).toBeNull();
    expect(opponentAfterKey('bot', 'ArrowRight')).toBe('friend');
    expect(opponentAfterKey('friend', 'ArrowRight')).toBe('bot');
    expect(opponentAfterKey('bot', 'ArrowUp')).toBe('friend');
    expect(opponentAfterKey('friend', 'Home')).toBe('bot');
    expect(opponentAfterKey('bot', 'Tab')).toBeNull();
  });
});
