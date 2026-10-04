import { describe, expect, it } from 'vitest';
import { TWO_PLAYERS, versusBot } from './mode';
import { endings } from './playouts.test-helper';
import { addResult, isScore, NO_SCORE, scoreAfter, scoreText } from './score';

describe('score of a sitting (PRD P3)', () => {
  it('counts each seat’s wins and the draws', () => {
    let score = NO_SCORE;
    score = addResult(score, { kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'A2', 'A3', 'A4'] });
    score = addResult(score, { kind: 'win', winner: 'A', by: 'blockade' });
    score = addResult(score, { kind: 'win', winner: 'B', by: 'square', cells: ['A1', 'A2', 'B1', 'B2'] });
    score = addResult(score, { kind: 'draw', by: 'full-board' });
    expect(score).toEqual({ A: 2, B: 1, draws: 1 });
    for (const state of Object.values(endings())) {
      const result = state.result!;
      const next = addResult(NO_SCORE, result);
      expect(next.A + next.B + next.draws).toBe(1);
      if (result.kind === 'win') expect(next[result.winner]).toBe(1);
    }
  });

  it('reads "Player 1 2 – 1 Player 2 · 1 draw" or "You 1 – 2 Bot"', () => {
    expect(scoreText({ A: 2, B: 1, draws: 1 }, TWO_PLAYERS)).toBe('Player 1 2 – 1 Player 2 · 1 draw');
    expect(scoreText({ A: 1, B: 2, draws: 0 }, versusBot('easy'))).toBe('You 1 – 2 Bot');
    expect(scoreText({ A: 0, B: 0, draws: 2 }, versusBot('normal'))).toBe('You 0 – 0 Bot · 2 draws');
    expect(scoreText(NO_SCORE, TWO_PLAYERS)).toBe('Player 1 0 – 0 Player 2');
  });

  it('is kept by Play again and reset by New game and by leaving to the title screen', () => {
    const score = { A: 3, B: 1, draws: 2 };
    expect(scoreAfter('play-again', score)).toBe(score);
    expect(scoreAfter('new-game', score)).toEqual(NO_SCORE);
    expect(scoreAfter('leave', score)).toEqual(NO_SCORE);
  });

  it('recognises a stored score and refuses anything else', () => {
    expect(isScore({ A: 1, B: 0, draws: 4 })).toBe(true);
    for (const bad of [null, 3, [], { A: 1, B: 0 }, { A: -1, B: 0, draws: 0 }, { A: 1.5, B: 0, draws: 0 }, { A: '1', B: 0, draws: 0 }]) expect(isScore(bad)).toBe(false);
  });
});
