import { describe, expect, it } from 'vitest';
import { newGame } from '@okiya/game';
import { nextStarter, startGame } from './match';
import { isPerson, modeLabel, personToMove, possessive, seatName, shortName, TWO_PLAYERS, versusBot } from './mode';
import { endings } from './playouts.test-helper';

const easy = versusBot('easy');

describe('game modes (PRD S1, §5.8)', () => {
  it('lets a person take for both seats of a two-player game, and only for Player 1 against the bot', () => {
    expect([isPerson(TWO_PLAYERS, 'A'), isPerson(TWO_PLAYERS, 'B')]).toEqual([true, true]);
    expect([isPerson(easy, 'A'), isPerson(easy, 'B')]).toEqual([true, false]);
    expect(personToMove(newGame({ seed: 2, starter: 'B' }), TWO_PLAYERS)).toBe(true);
    expect(personToMove(newGame({ seed: 2, starter: 'B' }), easy)).toBe(false);
    expect(personToMove(endings().line, TWO_PLAYERS)).toBe(false);
  });

  it('names the seats in each mode', () => {
    expect([seatName(easy, 'A'), seatName(easy, 'B'), seatName(TWO_PLAYERS, 'A'), seatName(TWO_PLAYERS, 'B')]).toEqual(['You', 'Bot · Easy', 'Player 1', 'Player 2']);
    expect([shortName(easy, 'B'), possessive(easy, 'A'), possessive(easy, 'B'), possessive(TWO_PLAYERS, 'B')]).toEqual(['Bot', 'your', "bot's", "Player 2's"]);
    expect([modeLabel(versusBot('hard')), modeLabel(TWO_PLAYERS)]).toEqual(['Hard bot', 'Two players']);
  });

  it('starts the next game with the other player, in both modes (Play again keeps the mode)', () => {
    for (const mode of [easy, TWO_PLAYERS]) {
      for (const finished of Object.values(endings())) {
        const next = { state: startGame(77, nextStarter(finished)), mode };
        expect(next.state.starter).not.toBe(finished.starter);
        expect(next.state.toMove).toBe(next.state.starter);
        expect(next.mode).toBe(mode);
      }
    }
  });
});
