import { describe, expect, it } from 'vitest';
import { outOfTime, tokenAt, ALL_CELLS } from '@okiya/game';
import {
  CLOCK_CHOICES,
  CLOCK_OPTIONS,
  clockChoiceAt,
  clockChoiceWords,
  clockMinutes,
  clockSetup,
  clockText,
  clockWords,
  isClockTimes,
  MAX_CLOCK_MS,
  outOfTimePlayer,
  runClock,
  startClock,
  timeLeft,
  timesLeft,
} from './clock';
import { endModel } from './end';
import { homeModel, playLabel } from './home';
import { clockOf, modeLabel, TWO_PLAYERS, twoPlayers, versusBot } from './mode';
import { afterTakes } from './playouts.test-helper';
import { emptyResults } from './results';
import { loadSavedGame, restoreSavedGame, saveGame, SAVE_KEY } from './save';
import { NO_SCORE, addResult } from './score';
import { seatClock, seatModels } from './seats';
import { DEFAULT_SETTINGS } from './settings';
import type { KeyValueStorage } from './storage';
import { resultDetail, resultSummary } from './text';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

describe('clock choices (two-player games)', () => {
  it('offers off and one to five minutes, and no more than five', () => {
    expect(CLOCK_CHOICES).toEqual(['off', '1', '2', '3', '4', '5']);
    expect(CLOCK_OPTIONS.map((option) => option.label)).toEqual(['Off', '1 min', '2 min', '3 min', '4 min', '5 min']);
    expect(MAX_CLOCK_MS).toBe(300_000);
  });

  it('maps the slider: off at 0, then whole minutes up to five, clamped and rounded, and says it in words', () => {
    expect(CLOCK_CHOICES.map(clockMinutes)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const choice of CLOCK_CHOICES) expect(clockChoiceAt(clockMinutes(choice))).toBe(choice);
    expect(clockChoiceAt(-3)).toBe('off');
    expect(clockChoiceAt(9)).toBe('5');
    expect(clockChoiceAt(2.4)).toBe('2');
    expect(clockChoiceAt(Number.NaN)).toBe('off');
    expect(['off', '1', '3'].map((choice) => clockChoiceWords(choice as 'off' | '1' | '3'))).toEqual(['Off', '1 minute', '3 minutes']);
  });

  it('gives each player their own starting time, or no clock, and none at all when both are off', () => {
    expect(clockSetup('5', '1')).toEqual({ A: 300_000, B: 60_000 });
    expect(clockSetup('off', '3')).toEqual({ A: null, B: 180_000 });
    expect(clockSetup('off', 'off')).toBeNull();
  });

  it('accepts only stored times from zero to five minutes with at least one clock', () => {
    expect(isClockTimes({ A: 300_000, B: null })).toBe(true);
    expect(isClockTimes({ A: 0, B: 1 })).toBe(true);
    for (const bad of [null, {}, { A: null, B: null }, { A: 300_001, B: null }, { A: -1, B: 5 }, { A: 1.5, B: 5 }, { A: '60000', B: null }]) expect(isClockTimes(bad), JSON.stringify(bad)).toBe(false);
  });
});

describe('the clock (two-player games)', () => {
  it('runs only the clock of the player to move and hands the time over on a take', () => {
    let clock = startClock({ A: 60_000, B: 120_000 }, 'A', 1_000);
    expect(timeLeft(clock, 'A', 11_000)).toBe(50_000);
    expect(timeLeft(clock, 'B', 11_000)).toBe(120_000);
    clock = runClock(clock, 'B', 11_000);
    expect(timesLeft(clock, 41_000)).toEqual({ A: 50_000, B: 90_000 });
    // Paused (no clock runs): nothing moves.
    clock = runClock(clock, null, 41_000);
    expect(timesLeft(clock, 500_000)).toEqual({ A: 50_000, B: 90_000 });
  });

  it('never runs a player without a clock, and never goes below zero', () => {
    const untimed = startClock({ A: null, B: 30_000 }, 'A', 0);
    expect(untimed.running).toBeNull();
    expect(timeLeft(untimed, 'A', 99_999)).toBeNull();
    const running = startClock({ A: null, B: 30_000 }, 'B', 0);
    expect(timeLeft(running, 'B', 45_000)).toBe(0);
  });

  it('names the player whose running clock reached zero, and nobody before', () => {
    const clock = startClock({ A: 5_000, B: 60_000 }, 'A', 0);
    expect(outOfTimePlayer(clock, 4_999)).toBeNull();
    expect(outOfTimePlayer(clock, 5_000)).toBe('A');
    expect(outOfTimePlayer(runClock(clock, null, 1_000), 99_000)).toBeNull();
  });

  it('shows minutes and seconds, rounding up so 0:00 means the time is gone, and says it in words', () => {
    expect(clockText(300_000)).toBe('5:00');
    expect(clockText(299_001)).toBe('5:00');
    expect(clockText(299_000)).toBe('4:59');
    expect(clockText(9_200)).toBe('0:10');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
    expect(clockWords(165_000)).toBe('2 minutes 45 seconds left');
    expect(clockWords(60_000)).toBe('1 minute left');
    expect(clockWords(1_000)).toBe('1 second left');
    expect(clockWords(0)).toBe('no time left');
  });
});

describe('a timed two-player game', () => {
  it('is set on the home screen while a friend is chosen, each player with their own time', () => {
    const settings = { ...DEFAULT_SETTINGS, opponent: 'friend' as const, clockA: '5' as const, clockB: '1' as const };
    const model = homeModel(null, settings, emptyResults());
    expect(model).toMatchObject({ showClocks: true, clockA: '5', clockB: '1', showDifficulty: false });
    expect(model.mode).toEqual(twoPlayers({ A: 300_000, B: 60_000 }));
    expect(model.playLabel).toBe('Play · with a friend · 5:00 / 1:00');
    expect(playLabel('friend', 'normal', 'off', '2')).toBe('Play · with a friend · no clock / 2:00');
    // Untimed, and against the bot: no clocks.
    expect(homeModel(null, { ...settings, clockA: 'off', clockB: 'off' }, emptyResults()).mode).toEqual(TWO_PLAYERS);
    expect(homeModel(null, { ...settings, opponent: 'bot' }, emptyResults())).toMatchObject({ showClocks: false, mode: versusBot('normal') });
    expect(clockOf(versusBot('hard'))).toBeNull();
    expect(modeLabel(twoPlayers({ A: 60_000, B: null }))).toBe('Two players, timed');
  });

  it('shows each player’s clock beside the name, running for the player to move, low under ten seconds', () => {
    const state = afterTakes(4, 2);
    const [one, two] = seatModels(state, twoPlayers({ A: 300_000, B: 9_500 }), NO_SCORE, undefined, 0, { times: { A: 165_000, B: 9_500 }, running: 'A' });
    expect(one.clock).toEqual({ text: '2:45', label: "Player 1's clock, 2 minutes 45 seconds left", ms: 165_000, running: true, low: false });
    expect(two.clock).toMatchObject({ text: '0:10', running: false, low: true });
    expect(seatClock('Player 2', null, false)).toBeNull();
    // An untimed game shows no clock.
    expect(seatModels(state, TWO_PLAYERS, NO_SCORE)[0].clock).toBeNull();
  });

  it('is lost by the player whose time ran out: the end screen says so and the score counts it', () => {
    const state = outOfTime(afterTakes(6, 3));
    const mode = twoPlayers({ A: 60_000, B: 60_000 });
    expect(state.result).toEqual({ kind: 'win', winner: 'A', by: 'time' });
    expect(resultSummary(state.result!, mode)).toBe('Player 1 wins on time');
    expect(resultDetail(state, mode)).toBe("Player 2's clock ran out.");
    expect(addResult(NO_SCORE, state.result!)).toEqual({ A: 1, B: 0, draws: 0 });
    // The tiles left grey out, like after a blockade: nobody takes another.
    const end = endModel(state)!;
    expect(end.kind).toBe('time');
    expect(end.greys).toEqual(ALL_CELLS.filter((cell) => tokenAt(state, cell) === null));
    expect(end.lifts).toEqual([]);
    expect(end.matchText).toBeNull();
  });

  it('is saved with its starting times and the time left, restored by Continue, and dropped once finished', () => {
    const storage = memoryStorage();
    const state = afterTakes(5, 3);
    const mode = twoPlayers({ A: 300_000, B: 60_000 });
    saveGame(storage, state, mode, { A: 1, B: 0, draws: 0 }, { A: 212_345, B: 41_000 });
    const stored = JSON.parse(storage.data.get(SAVE_KEY)!);
    expect(stored.clock).toEqual({ start: { A: 300_000, B: 60_000 }, left: { A: 212_345, B: 41_000 } });
    expect(loadSavedGame(storage)).toEqual({ state, mode, score: { A: 1, B: 0, draws: 0 }, clockLeft: { A: 212_345, B: 41_000 } });
    // Without a reading yet, the starting times are saved as the time left.
    saveGame(storage, state, mode, NO_SCORE);
    expect(loadSavedGame(storage)!.clockLeft).toEqual({ A: 300_000, B: 60_000 });
    // A finished game, including one lost on time, is removed.
    saveGame(storage, outOfTime(state), mode, NO_SCORE);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it('discards a save whose clocks do not fit: more time left than at the start, or a clock that appeared', () => {
    const log = JSON.parse(JSON.stringify({ formatVersion: 1, seed: 5, starter: 'A', takes: [] }));
    const save = (clock: unknown) => JSON.stringify({ version: 3, mode: 'two-player', score: NO_SCORE, clock, log });
    expect(restoreSavedGame(save({ start: { A: 60_000, B: null }, left: { A: 30_000, B: null } }))?.clockLeft).toEqual({ A: 30_000, B: null });
    expect(restoreSavedGame(save({ start: { A: 60_000, B: null }, left: { A: 90_000, B: null } }))).toBeNull();
    expect(restoreSavedGame(save({ start: { A: 60_000, B: null }, left: { A: 30_000, B: 10_000 } }))).toBeNull();
    expect(restoreSavedGame(save('five minutes'))).toBeNull();
    // A two-player save without clocks is an untimed game.
    expect(restoreSavedGame(JSON.stringify({ version: 3, mode: 'two-player', score: NO_SCORE, log }))).toMatchObject({ mode: TWO_PLAYERS, clockLeft: null });
  });
});
