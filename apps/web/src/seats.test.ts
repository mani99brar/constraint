import { describe, expect, it } from 'vitest';
import { TWO_PLAYERS, versusBot } from './mode';
import { handBuilt } from './playouts.test-helper';
import { NO_SCORE } from './score';
import { seatModels, turnLabel } from './seats';

const easy = versusBot('easy');
const forestStar = { terrain: 'Forest', symbol: 'Star' } as const;

describe('seat model (PRD U2, I3, §5.8)', () => {
  it('names the seats "You" and "Bot · <difficulty>" in a bot game, "Player 1" and "Player 2" in a two-player game', () => {
    const state = handBuilt([], 'A', null);
    expect(seatModels(state, easy, NO_SCORE).map((seat) => seat.name)).toEqual(['You', 'Bot · Easy']);
    expect(seatModels(state, versusBot('hard'), NO_SCORE)[1].name).toBe('Bot · Hard');
    expect(seatModels(state, versusBot('normal'), NO_SCORE)[1].name).toBe('Bot · Normal');
    expect(seatModels(state, TWO_PLAYERS, NO_SCORE).map((seat) => seat.name)).toEqual(['Player 1', 'Player 2']);
  });

  it('gives Player 1 the ring and Player 2 the diamond, in both modes', () => {
    for (const mode of [easy, TWO_PLAYERS]) {
      const [one, two] = seatModels(handBuilt([], 'A', null), mode, NO_SCORE);
      expect([one.player, one.number, one.mark]).toEqual(['A', 1, 'ring']);
      expect([two.player, two.number, two.mark]).toEqual(['B', 2, 'diamond']);
    }
  });

  it('counts each seat’s tokens left out of 8', () => {
    const state = handBuilt(['A', 'B', 'A', 'B', 'A'], 'B', forestStar);
    for (const mode of [easy, TWO_PLAYERS]) {
      const [one, two] = seatModels(state, mode, NO_SCORE);
      expect([one.tokensLeft, one.tokensTotal, one.tokensLabel]).toEqual([5, 8, '5 of 8 tokens left']);
      expect([two.tokensLeft, two.tokensTotal, two.tokensLabel]).toEqual([6, 8, '6 of 8 tokens left']);
    }
  });

  it('shows each seat’s wins in the sitting', () => {
    const [one, two] = seatModels(handBuilt([], 'A', null), TWO_PLAYERS, { A: 2, B: 1, draws: 3 });
    expect([one.score, two.score]).toEqual([2, 1]);
  });

  it.each([
    ['a bot game, your move', easy, 'A', ['Your move', null], [true, false]],
    ['a bot game, the bot’s move', easy, 'B', [null, 'Bot is thinking'], [false, true]],
    ['a two-player game, Player 1 to move', TWO_PLAYERS, 'A', ["Player 1's move", null], [true, false]],
    ['a two-player game, Player 2 to move', TWO_PLAYERS, 'B', [null, "Player 2's move"], [false, true]],
  ] as const)('lights and labels the seat to move and dims the other: %s', (_name, mode, toMove, statuses, lit) => {
    for (const lastTile of [null, forestStar]) {
      const seats = seatModels(handBuilt(lastTile ? ['A'] : [], toMove, lastTile), mode, NO_SCORE);
      expect(seats.map((seat) => seat.status)).toEqual(statuses);
      expect(seats.map((seat) => seat.lit)).toEqual(lit);
      expect(seats.map((seat) => seat.expression)).toEqual(lit.map((on) => (on ? 'to-move' : 'idle')));
    }
  });

  it('gives the turn label on its own, and none once the game has ended', () => {
    expect(turnLabel({ toMove: 'A', result: null }, easy)).toBe('Your move');
    expect(turnLabel({ toMove: 'B', result: null }, easy)).toBe('Bot is thinking');
    expect(turnLabel({ toMove: 'A', result: null }, TWO_PLAYERS)).toBe("Player 1's move");
    expect(turnLabel({ toMove: 'B', result: null }, TWO_PLAYERS)).toBe("Player 2's move");
    expect(turnLabel({ toMove: 'B', result: { kind: 'draw', by: 'full-board' } }, TWO_PLAYERS)).toBeNull();
  });

  it('shows "won" on the winner’s avatar and "lost" on the other at the end, with no seat lit', () => {
    for (const mode of [easy, TWO_PLAYERS]) {
      for (const winner of ['A', 'B'] as const) {
        for (const by of ['line', 'square', 'blockade'] as const) {
          const result = by === 'blockade' ? ({ kind: 'win', winner, by } as const) : ({ kind: 'win', winner, by, cells: ['A1', 'A2', 'A3', 'A4'] } as const);
          const seats = seatModels(handBuilt(['A', 'B'], winner === 'A' ? 'B' : 'A', forestStar, { result }), mode, NO_SCORE);
          expect(seats.map((seat) => seat.lit)).toEqual([false, false]);
          expect(seats.map((seat) => seat.expression)).toEqual(winner === 'A' ? ['won', 'lost'] : ['lost', 'won']);
          expect(seats.map((seat) => seat.status)).toEqual(winner === 'A' ? ['Winner', null] : [null, 'Winner']);
        }
      }
    }
  });

  it('leaves both avatars idle after a full-board draw, both seats saying "Draw"', () => {
    const tokens = Array.from({ length: 16 }, (_, i) => (i % 2 ? 'B' : 'A') as 'A' | 'B');
    const seats = seatModels(handBuilt(tokens, 'A', forestStar, { result: { kind: 'draw', by: 'full-board' } }), TWO_PLAYERS, NO_SCORE);
    expect(seats.map((seat) => [seat.lit, seat.expression, seat.status, seat.tokensLeft])).toEqual([
      [false, 'idle', 'Draw', 0],
      [false, 'idle', 'Draw', 0],
    ]);
  });
});
