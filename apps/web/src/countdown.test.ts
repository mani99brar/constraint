import { describe, expect, it } from 'vitest';
import { newGame } from '@okiya/game';
import { boardModel } from './boardModel';
import { COUNTDOWN_FROM, COUNTDOWN_STEP_MS, countdownWords } from './countdown';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes } from './playouts.test-helper';
import { DEFAULT_SETTINGS, loadSettings } from './settings';
import type { KeyValueStorage } from './storage';

describe('the countdown before a new game', () => {
  it('counts 3, 2, 1 at 600 ms a step, under two seconds in all, and says it in words', () => {
    expect(COUNTDOWN_FROM).toBe(3);
    expect(COUNTDOWN_STEP_MS).toBe(600);
    expect(COUNTDOWN_FROM * COUNTDOWN_STEP_MS).toBeLessThan(2_000);
    expect([3, 2, 1].map(countdownWords)).toEqual(['Starting in 3', 'Starting in 2', 'Starting in 1']);
  });

  it('keeps the board waiting while it runs: nobody takes, nothing glows or fades, in either mode', () => {
    for (const [state, mode] of [
      [newGame({ seed: 4, starter: 'A' }), TWO_PLAYERS],
      [afterTakes(4, 2), versusBot('easy')],
    ] as const) {
      const waiting = boardModel(state, { mode, highlights: true, waiting: true });
      expect(waiting.acceptsTakes).toBe(false);
      expect(waiting.glowing).toEqual([]);
      expect(waiting.cells.filter((cell) => cell.faded)).toEqual([]);
      // Once it ends, the board is as it would have been.
      const started = boardModel(state, { mode, highlights: true });
      expect(started.acceptsTakes).toBe(true);
      expect(started.glowing.length).toBeGreaterThan(0);
    }
  });

  it('is on by default, and settings stored before it existed load with it on', () => {
    expect(DEFAULT_SETTINGS.countdown).toBe(true);
    const data = new Map([['okiya.settings', JSON.stringify({ highlights: true, sound: true, palette: 'walnut' })]]);
    const storage: KeyValueStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
    expect(loadSettings(storage).countdown).toBe(true);
    data.set('okiya.settings', JSON.stringify({ countdown: false }));
    expect(loadSettings(storage).countdown).toBe(false);
  });
});
