import { describe, expect, it } from 'vitest';
import { tileAt } from '@okiya/game';
import { matchCardModel, OPENING_LABEL } from './matchCard';
import { afterTakes, handBuilt } from './playouts.test-helper';

describe('Match card model (PRD I1)', () => {
  it('says "Any edge tile" at the opening', () => {
    const model = matchCardModel(handBuilt([], 'A', null));
    expect(OPENING_LABEL).toBe('Any edge tile');
    expect(model).toMatchObject({ terrain: null, symbol: null, text: 'Any edge tile', label: 'Tile to match: any edge tile', cell: null, takes: 0 });
  });

  it('gives the last tile’s terrain, symbol and names', () => {
    const model = matchCardModel(handBuilt(['A'], 'B', { terrain: 'Desert', symbol: 'Moon' }));
    expect(model).toMatchObject({ terrain: 'Desert', symbol: 'Moon', text: 'Desert–Moon', label: 'Tile to match: Desert–Moon', cell: 'A1', takes: 1 });
  });

  it('follows the latest take of a real game', () => {
    for (let takes = 1; takes <= 6; takes += 1) {
      const state = afterTakes(23, takes);
      const last = state.takes[takes - 1]!;
      const tile = tileAt(state, last);
      expect(matchCardModel(state)).toMatchObject({ terrain: tile.terrain, symbol: tile.symbol, cell: last, takes });
    }
  });

  it('says no tile matches after a blockade, and only then', () => {
    const blockade = handBuilt(['A', 'B', 'A'], 'B', { terrain: 'Desert', symbol: 'Star' }, { result: { kind: 'win', winner: 'A', by: 'blockade' } });
    expect(matchCardModel(blockade)).toMatchObject({ terrain: 'Desert', symbol: 'Star', blocked: 'No tile matches Desert–Star', label: 'No tile matches Desert–Star' });
    expect(matchCardModel(handBuilt(['A'], 'B', { terrain: 'Desert', symbol: 'Moon' })).blocked).toBeNull();
    const line = handBuilt(['A'], 'B', { terrain: 'Desert', symbol: 'Moon' }, { result: { kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'A2', 'A3', 'A4'] } });
    expect(matchCardModel(line).blocked).toBeNull();
  });
});
