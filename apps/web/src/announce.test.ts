import { describe, expect, it } from 'vitest';
import { legalTakes, newGame, take, tileAt, type GameState } from '@okiya/game';
import { takeText, turnAnnouncement } from './announce';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings } from './playouts.test-helper';
import { resultSummary, tileName } from './text';

const normal = versusBot('normal');

function takeFirst(state: GameState): GameState {
  const taken = take(state, legalTakes(state)[0]!);
  if (!taken.ok) throw new Error('refused');
  return taken.state;
}

describe('turn announcements (PRD I3, U3)', () => {
  it('names the bot’s take, as its toast reads: "Bot took D3, Desert–Star"', () => {
    const state = afterTakes(9, 2);
    const cell = state.takes[1]!;
    expect(takeText(state, normal)).toBe(`Bot took ${cell}, ${tileName(tileAt(state, cell))}`);
    expect(takeText(state, normal)).toMatch(/^Bot took [A-D][1-4], \w+–\w+$/);
    expect(turnAnnouncement(state, normal)).toBe(`Bot took ${cell}, ${tileName(tileAt(state, cell))}. Your move.`);
  });

  it('gives the line for each change of turn in a bot game', () => {
    const youStart = newGame({ seed: 9, starter: 'A' });
    expect(turnAnnouncement(youStart, normal)).toBe('You start. Your move.');
    const afterYours = takeFirst(youStart);
    const yours = afterYours.takes[0]!;
    expect(turnAnnouncement(afterYours, normal)).toBe(`You took ${yours}, ${tileName(tileAt(afterYours, yours))}. Bot is thinking.`);
    expect(turnAnnouncement(newGame({ seed: 9, starter: 'B' }), normal)).toBe('The bot starts. Bot is thinking.');
  });

  it('gives the line for each change of turn in a two-player game, naming the seats', () => {
    let state = newGame({ seed: 9, starter: 'B' });
    expect(turnAnnouncement(state, TWO_PLAYERS)).toBe("Player 2 starts. Player 2's move.");
    for (let i = 0; i < 4; i += 1) {
      state = takeFirst(state);
      const cell = state.takes[i]!;
      const [taker, next] = state.toMove === 'A' ? ['Player 2', 'Player 1'] : ['Player 1', 'Player 2'];
      expect(turnAnnouncement(state, TWO_PLAYERS)).toBe(`${taker} took ${cell}, ${tileName(tileAt(state, cell))}. ${next}'s move.`);
    }
  });

  it('ends with the last take and the result, in both modes', () => {
    for (const state of Object.values(endings())) {
      for (const mode of [normal, TWO_PLAYERS]) {
        const line = turnAnnouncement(state, mode);
        expect(line).toBe(`${takeText(state, mode)}. ${resultSummary(state.result!, mode)}.`);
      }
    }
  });

  it('says nothing about a take before the first one', () => {
    expect(takeText(newGame({ seed: 1 }), TWO_PLAYERS)).toBeNull();
  });
});
