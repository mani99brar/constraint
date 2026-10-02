import { describe, expect, it } from 'vitest';
import { ALL_CELLS, newGame, type GameState, type Player } from '@okiya/game';
import { OPENING_LABEL, topBarModel } from './topbar';

const base = newGame({ seed: 11, starter: 'A' });

/** A hand-built state: the given tokens on the first cells, the last tile and the player to move. */
function handBuilt(tokens: readonly (Player | null)[], toMove: Player, lastTile: GameState['lastTile'], starter: Player = 'A'): GameState {
  const padded = [...tokens, ...Array<Player | null>(16 - tokens.length).fill(null)];
  return { ...base, tokens: padded, toMove, starter, lastTile, takes: ALL_CELLS.filter((_, i) => padded[i] !== null) };
}

describe('top bar model (PRD U2, I1)', () => {
  it('says whose turn it is and who starts, with "Any edge tile" at the opening', () => {
    const yours = topBarModel(handBuilt([], 'A', null), 'A');
    expect(yours.turnText).toBe('Your turn');
    expect(yours.humanTurn).toBe(true);
    expect(yours.botThinking).toBe(false);
    expect(yours.starterText).toBe('You start');
    expect(yours.lastTile).toBeNull();
    expect(yours.lastTileLabel).toBe(OPENING_LABEL);
    expect(OPENING_LABEL).toBe('Any edge tile');

    const bots = topBarModel(handBuilt([], 'B', null, 'B'), 'A');
    expect(bots.turnText).toBe('Bot is thinking');
    expect(bots.humanTurn).toBe(false);
    expect(bots.botThinking).toBe(true);
    expect(bots.starterText).toBe('Bot starts');
  });

  it('shows the last tile as its terrain and symbol emblems with their names', () => {
    const model = topBarModel(handBuilt(['A'], 'B', { terrain: 'Desert', symbol: 'Moon' }), 'A');
    expect(model.turnText).toBe('Bot is thinking');
    expect(model.starterText).toBeNull();
    expect(model.lastTile).toEqual([
      { kind: 'terrain', terrain: 'Desert', name: 'Desert' },
      { kind: 'symbol', symbol: 'Moon', name: 'Moon' },
    ]);
    expect(model.lastTileLabel).toBe('Last tile: Desert–Moon');
  });

  it('counts each player’s remaining tokens out of 8, yours first', () => {
    const model = topBarModel(handBuilt(['A', 'B', 'A', 'B', 'A'], 'B', { terrain: 'Forest', symbol: 'Star' }), 'A');
    expect(model.counts.map((count) => [count.side, count.left, count.total])).toEqual([
      ['You', 5, 8],
      ['Bot', 6, 8],
    ]);
    expect(model.counts[0].label).toBe('Your tokens: 5 of 8 left');
    expect(model.counts[1].label).toBe("Bot's tokens: 6 of 8 left");
    const full = topBarModel({ ...handBuilt(Array.from({ length: 16 }, (_, i) => (i % 2 ? 'B' : 'A')), 'A', { terrain: 'Water', symbol: 'Sun' }), result: { kind: 'draw', by: 'full-board' } }, 'A');
    expect(full.counts.map((count) => count.left)).toEqual([0, 0]);
  });

  it('shows the result instead of a turn once the game has ended', () => {
    const won = topBarModel({ ...handBuilt(['A'], 'B', { terrain: 'Forest', symbol: 'Sun' }), result: { kind: 'win', winner: 'A', by: 'blockade' } }, 'A');
    expect(won.turnText).toBe('You win by blockade');
    expect(won.humanTurn).toBe(false);
    expect(won.botThinking).toBe(false);
  });
});
