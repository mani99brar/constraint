import { describe, expect, it } from 'vitest';
import { legalTakes, newGame, PLAYERS } from '@okiya/game';
import { BOT, botStep, botToMove, HUMAN, humanToMove, nextStarter, startGame } from './match';
import { afterTakes, endings } from './playouts.test-helper';

describe('starting players (PRD S2, spec §5)', () => {
  it('starts the next game with the other player', () => {
    expect(nextStarter({ starter: 'A' })).toBe('B');
    expect(nextStarter({ starter: 'B' })).toBe('A');
    for (const finished of Object.values(endings())) {
      const next = startGame(1234, nextStarter(finished));
      expect(next.starter).not.toBe(finished.starter);
      expect(next.toMove).toBe(next.starter);
      expect(next.takes).toEqual([]);
    }
  });

  it('lets the seed choose the very first starter, so both players start some games', () => {
    const starters = new Set(Array.from({ length: 40 }, (_, seed) => startGame(seed).starter));
    expect(starters).toEqual(new Set(PLAYERS));
    expect(startGame(7)).toEqual(newGame({ seed: 7 }));
    expect(startGame(7, 'B').starter).toBe('B');
  });
});

describe('bot scheduling (PRD B1, B5)', () => {
  it('takes one legal tile on the bot’s turn, at every difficulty', () => {
    const state = afterTakes(5, 1);
    expect(botToMove(state)).toBe(true);
    expect(humanToMove(state)).toBe(false);
    for (const difficulty of ['easy', 'normal'] as const) {
      const next = botStep(state, 1, difficulty);
      expect(next.takes).toHaveLength(2);
      expect(legalTakes(state)).toContain(next.takes[1]);
      expect(next.tokens.filter((token) => token === BOT)).toHaveLength(1);
    }
  });

  it('leaves the state alone when the scheduled turn has passed or it is not the bot’s turn (StrictMode)', () => {
    const state = afterTakes(5, 1);
    const once = botStep(state, 1, 'easy');
    expect(botStep(once, 1, 'easy')).toBe(once);
    expect(botStep(state, 0, 'easy')).toBe(state);
    const human = newGame({ seed: 5, starter: HUMAN });
    expect(botStep(human, 0, 'easy')).toBe(human);
    const finished = endings().square;
    expect(botStep(finished, finished.takes.length, 'easy')).toBe(finished);
  });
});
