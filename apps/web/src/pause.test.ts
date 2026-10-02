import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOT, BOT_DELAY_MS, scheduleBotTake, startGame } from './match';
import type { GameState } from '@okiya/game';

// The bot takes after a short pause, so the player can follow it (PRD B5).

const botStarts = (): GameState => startGame(11, BOT);

afterEach(() => {
  vi.useRealTimers();
});

describe('the bot pause (PRD B5)', () => {
  it('is short but visible', () => {
    expect(BOT_DELAY_MS).toBeGreaterThanOrEqual(300);
    expect(BOT_DELAY_MS).toBeLessThanOrEqual(1500);
  });

  it('delivers the bot\'s take only once the pause has passed', () => {
    vi.useFakeTimers();
    const delivered: GameState[] = [];
    const state = botStarts();
    scheduleBotTake(state, 'easy', (next) => delivered.push(next));
    vi.advanceTimersByTime(BOT_DELAY_MS - 1);
    expect(delivered).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.takes).toHaveLength(1);
    expect(delivered[0]!.toMove).not.toBe(BOT);
  });

  it('never delivers once cancelled, as when StrictMode remounts the effect', () => {
    vi.useFakeTimers();
    const delivered: GameState[] = [];
    const cancel = scheduleBotTake(botStarts(), 'easy', (next) => delivered.push(next));
    cancel();
    vi.advanceTimersByTime(BOT_DELAY_MS * 2);
    expect(delivered).toEqual([]);
  });
});
