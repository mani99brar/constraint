import { describe, expect, it } from 'vitest';
import { newGame } from '@okiya/game';
import { takeFeedback } from './feedback';
import { afterTakes, endings } from './playouts.test-helper';

describe('take feedback (PRD U3, E4)', () => {
  it('is quiet when no new take was made, as for a resumed game', () => {
    expect(takeFeedback(newGame({ seed: 1 }), 0, 'A')).toEqual({ sound: null, toasts: [] });
    const resumed = afterTakes(1, 5);
    expect(takeFeedback(resumed, 5, 'A')).toEqual({ sound: null, toasts: [] });
  });

  it('plays the human’s or the bot’s take sound, without a toast', () => {
    expect(takeFeedback(afterTakes(1, 1, 'A'), 0, 'A')).toEqual({ sound: 'place', toasts: [] });
    expect(takeFeedback(afterTakes(1, 2, 'A'), 1, 'A')).toEqual({ sound: 'bot', toasts: [] });
  });

  it('ends the game with the result’s sound and a toast naming it', () => {
    for (const state of Object.values(endings())) {
      const feedback = takeFeedback(state, state.takes.length - 1, 'A');
      const result = state.result!;
      const outcome = result.kind === 'draw' ? 'draw' : result.winner === 'A' ? 'win' : 'loss';
      expect(feedback.sound).toBe(outcome);
      expect(feedback.toasts).toHaveLength(1);
      expect(feedback.toasts[0]).toMatchObject({ kind: 'end', tone: outcome === 'loss' ? 'alert' : 'info' });
      expect(feedback.toasts[0]!.text).toMatch(/^(You win|The bot wins|Draw)/);
    }
  });
});
