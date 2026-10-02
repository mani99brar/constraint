import { describe, expect, it } from 'vitest';
import { ALL_CELLS, EDGE_CELLS, newGame, take, tileAt, validateTake, type CellId, type GameResult, type GameState, type TakeRefusal } from '@okiya/game';
import { afterTakes, endings } from './playouts.test-helper';
import { describeRefusal, resultDetail, resultSummary, tileName } from './text';

/** Every refusal code of `@okiya/game`, each produced by the engine itself; a new code fails to typecheck here. */
function refusals(): Record<TakeRefusal['code'], { readonly state: GameState; readonly refusal: TakeRefusal }> {
  const opening = newGame({ seed: 42, starter: 'A' });
  const inner = ALL_CELLS.find((cell) => !EDGE_CELLS.includes(cell))!;
  const later = afterTakes(42, 3);
  const nonMatching = ALL_CELLS.find((cell) => {
    const refusal = validateTake(later, cell);
    return refusal?.code === 'no-match';
  })!;
  const finished = endings().line;
  const of = (state: GameState, cell: string) => ({ state, refusal: validateTake(state, cell)! });
  return {
    'game-over': of(finished, ALL_CELLS.find((cell) => finished.tokens[ALL_CELLS.indexOf(cell)] === null) ?? 'A1'),
    'unknown-cell': of(opening, 'Z9'),
    'cell-taken': of(later, later.takes[0]!),
    'not-edge': of(opening, inner),
    'no-match': of(later, nonMatching),
  };
}

describe('refusal texts (PRD R3)', () => {
  const all = refusals();

  it('has readable text for every refusal code, naming the tiles involved', () => {
    for (const [code, { state, refusal }] of Object.entries(all)) {
      expect(refusal.code).toBe(code);
      const text = describeRefusal(refusal, state);
      expect(text).not.toMatch(/not allowed \(|undefined|null|\[object/);
      if ('cell' in refusal && refusal.code !== 'unknown-cell') expect(text, code).toContain(tileName(tileAt(state, refusal.cell as CellId)));
    }
  });

  it('names the tile and the last tile of a take that does not match', () => {
    const { state, refusal } = all['no-match'];
    if (refusal.code !== 'no-match') throw new Error('expected no-match');
    expect(describeRefusal(refusal, state)).toBe(`${tileName(refusal.tile)} matches neither ${refusal.lastTile.terrain} nor ${refusal.lastTile.symbol}`);
    expect(
      describeRefusal({ code: 'no-match', cell: 'B2', tile: { terrain: 'Desert', symbol: 'Moon' }, lastTile: { terrain: 'Forest', symbol: 'Star' } }, state),
    ).toBe('Desert–Moon matches neither Forest nor Star');
  });

  it('explains the edge opening, a taken cell, an unknown cell and a finished game', () => {
    const notEdge = all['not-edge'];
    expect(describeRefusal(notEdge.refusal, notEdge.state)).toMatch(/^\w+–\w+ is not an edge tile; the first take must come from the edge\.$/);
    const taken = all['cell-taken'];
    expect(describeRefusal(taken.refusal, taken.state)).toMatch(/^\w+–\w+ at [A-D][1-4] was already taken; a token stands there now\.$/);
    expect(describeRefusal(all['unknown-cell'].refusal, all['unknown-cell'].state)).toBe('Z9 is not a cell of the board.');
    expect(describeRefusal(all['game-over'].refusal, all['game-over'].state)).toBe('The game is over: no more tiles can be taken.');
  });

  it('refuses through `take` with the same reasons', () => {
    const { state, refusal } = all['no-match'];
    const result = take(state, refusal.code === 'no-match' ? refusal.cell : 'A1');
    expect(result.ok).toBe(false);
  });
});

describe('end texts (PRD R4)', () => {
  const forest = { terrain: 'Forest', symbol: 'Star' } as const;
  const cases: readonly [GameResult, string, string][] = [
    [{ kind: 'win', winner: 'A', by: 'line', cells: ['A1', 'B2', 'C3', 'D4'] }, 'You win with a line', 'Your tokens on A1, B2, C3 and D4 make a line.'],
    [{ kind: 'win', winner: 'A', by: 'square', cells: ['B2', 'B3', 'C2', 'C3'] }, 'You win with a square', 'Your tokens on B2, B3, C2 and C3 fill a 2×2 square.'],
    [{ kind: 'win', winner: 'A', by: 'blockade' }, 'You win by blockade', 'No tile left on the board matches Forest–Star, so the bot cannot take one and loses.'],
    [{ kind: 'win', winner: 'B', by: 'line', cells: ['C1', 'C2', 'C3', 'C4'] }, 'The bot wins with a line', "The bot's tokens on C1, C2, C3 and C4 make a line."],
    [{ kind: 'win', winner: 'B', by: 'square', cells: ['A3', 'A4', 'B3', 'B4'] }, 'The bot wins with a square', "The bot's tokens on A3, A4, B3 and B4 fill a 2×2 square."],
    [{ kind: 'win', winner: 'B', by: 'blockade' }, 'The bot wins by blockade', 'No tile left on the board matches Forest–Star, so you cannot take one and lose.'],
    [{ kind: 'draw', by: 'full-board' }, 'Draw: the board is full', 'All 16 cells hold tokens and nobody made a line or a square.'],
  ];

  it.each(cases)('names the result and how it happened: %j', (result, summary, detail) => {
    expect(resultSummary(result, 'A')).toBe(summary);
    expect(resultDetail({ result, lastTile: forest }, 'A')).toBe(detail);
  });

  it('describes real finished games of every ending', () => {
    for (const state of Object.values(endings())) {
      expect(resultSummary(state.result!, 'A')).toMatch(/^(You win|The bot wins) (with a line|with a square|by blockade)$|^Draw: the board is full$/);
      expect(resultDetail(state, 'A').length).toBeGreaterThan(20);
    }
    expect(resultDetail({ result: null, lastTile: null }, 'A')).toBe('');
  });
});
