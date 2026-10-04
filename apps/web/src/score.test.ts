import { describe, expect, it } from 'vitest';
import { TWO_PLAYERS, versusBot } from './mode';
import { endings } from './playouts.test-helper';
import { addResult, isScore, NO_SCORE, scoreAfter, scoreboardModel } from './score';

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

  it('gives the scoreboard each seat’s wins on its side with its token mark, the draws hidden at zero, and an accessible name that reads the score, in both modes', () => {
    const bot = scoreboardModel({ A: 2, B: 1, draws: 1 }, versusBot('easy'));
    expect(bot.sides.map(({ player, number, name, mark, wins }) => [player, number, name, mark, wins])).toEqual([
      ['A', 1, 'You', 'ring', 2],
      ['B', 2, 'Bot', 'diamond', 1],
    ]);
    expect(bot.drawsText).toBe('1 draw');
    expect(bot.label).toBe('You 2, Bot 1, 1 draw');
    const pair = scoreboardModel({ A: 0, B: 3, draws: 2 }, TWO_PLAYERS);
    expect(pair.sides.map(({ name, wins }) => [name, wins])).toEqual([
      ['Player 1', 0],
      ['Player 2', 3],
    ]);
    expect(pair.drawsText).toBe('2 draws');
    expect(pair.label).toBe('Player 1 0, Player 2 3, 2 draws');
    // No draws: the line is hidden and the name leaves them out.
    for (const mode of [versusBot('normal'), TWO_PLAYERS]) {
      const fresh = scoreboardModel(NO_SCORE, mode);
      expect(fresh.drawsText).toBeNull();
      expect(fresh.draws).toBe(0);
      expect(fresh.label).toBe(mode.kind === 'bot' ? 'You 0, Bot 0' : 'Player 1 0, Player 2 0');
    }
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
