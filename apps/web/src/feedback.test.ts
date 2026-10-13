import { describe, expect, it } from 'vitest';
import { newGame, otherPlayer } from '@okiya/game';
import { takeFeedback } from './feedback';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings } from './playouts.test-helper';

const easy = versusBot('easy');

describe('take feedback (PRD U3, E4)', () => {
  it('is quiet when no new take was made, as for a resumed game', () => {
    for (const mode of [easy, TWO_PLAYERS]) {
      expect(takeFeedback(newGame({ seed: 1 }), 0, mode)).toEqual({ sound: null, toasts: [], turnChanged: false });
      expect(takeFeedback(afterTakes(1, 5), 5, mode)).toEqual({ sound: null, toasts: [], turnChanged: false });
    }
  });

  it('plays the human’s take sound without a toast, and toasts the bot’s take by name', () => {
    expect(takeFeedback(afterTakes(1, 1, 'A'), 0, easy)).toEqual({ sound: 'place', toasts: [], turnChanged: true });
    const botTook = afterTakes(1, 2, 'A');
    const feedback = takeFeedback(botTook, 1, easy);
    expect(feedback.sound).toBe('bot');
    expect(feedback.turnChanged).toBe(true);
    expect(feedback.toasts).toEqual([{ kind: 'take', tone: 'info', text: expect.stringMatching(/^Bot took \w+–\w+$/), short: expect.stringMatching(/^Bot took \w+–\w+$/) }]);
  });

  it('makes no take toast in a two-player game, for either seat', () => {
    for (let takes = 1; takes <= 6; takes += 1) {
      const feedback = takeFeedback(afterTakes(1, takes), takes - 1, TWO_PLAYERS);
      expect(feedback.toasts).toEqual([]);
      expect(feedback.turnChanged).toBe(true);
      expect(feedback.sound).toBe(takes % 2 === 1 ? 'place' : 'bot');
    }
  });

  it('ends the game with the result’s sound and no end toast, in either mode; the bot’s last take is still toasted', () => {
    const states = Object.values(endings());
    // The endings include a game the bot's take ends, so that toast is exercised.
    expect(states.some((state) => otherPlayer(state.toMove) === 'B')).toBe(true);
    for (const state of states) {
      const result = state.result!;
      const bot = takeFeedback(state, state.takes.length - 1, easy);
      expect(bot.sound).toBe(result.kind === 'draw' ? 'draw' : result.winner === 'A' ? 'win' : 'loss');
      const last = state.takes[state.takes.length - 1]!;
      expect(bot.toasts).toEqual(
        otherPlayer(state.toMove) === 'B' ? [{ kind: 'take', tone: 'info', text: expect.stringMatching(/^Bot took \w+–\w+$/), short: expect.stringMatching(/^Bot took \w+–\w+$/) }] : [],
      );
      const pair = takeFeedback(state, state.takes.length - 1, TWO_PLAYERS);
      expect(pair.sound).toBe(result.kind === 'draw' ? 'draw' : 'win');
      expect(pair.toasts).toEqual([]);
      expect(pair.turnChanged).toBe(true);
    }
  });
});
