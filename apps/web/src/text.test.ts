import { describe, expect, it } from 'vitest';
import { ALL_CELLS, EDGE_CELLS, newGame, take, tileAt, validateTake, type CellId, type GameResult, type GameState, type TakeRefusal } from '@okiya/game';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings } from './playouts.test-helper';
import { describeRefusal, resultDetail, resultSummary, shortRefusal, tileName } from './text';

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

  it('has a one-line phone form for every refusal kind, chosen by the kind and naming the tiles briefly', () => {
    const forms = Object.fromEntries(Object.entries(all).map(([code, { refusal }]) => [code, shortRefusal(refusal)]));
    expect(forms['not-edge']).toBe('Edge tiles only at the start');
    expect(forms['cell-taken']).toBe(`${(all['cell-taken'].refusal as { cell: CellId }).cell} is already taken`);
    expect(forms['unknown-cell']).toBe('Z9 is not a cell');
    expect(forms['game-over']).toBe('The game is over');
    expect(shortRefusal({ code: 'no-match', cell: 'B2', tile: { terrain: 'Desert', symbol: 'Moon' }, lastTile: { terrain: 'Forest', symbol: 'Star' } })).toBe("Desert–Moon doesn't match Forest–Star");
    // Each fits one phone line: the longest tile names together stay under 42 characters.
    expect(shortRefusal({ code: 'no-match', cell: 'B2', tile: { terrain: 'Mountain', symbol: 'Wave' }, lastTile: { terrain: 'Mountain', symbol: 'Star' } }).length).toBeLessThanOrEqual(42);
    for (const form of Object.values(forms)) expect(form.length).toBeLessThanOrEqual(42);
  });

  it('refuses through `take` with the same reasons', () => {
    const { state, refusal } = all['no-match'];
    const result = take(state, refusal.code === 'no-match' ? refusal.cell : 'A1');
    expect(result.ok).toBe(false);
  });
});

describe('end texts (PRD R4)', () => {
  const forest = { terrain: 'Forest', symbol: 'Star' } as const;
  const bot = versusBot('normal');
  const line = (winner: 'A' | 'B') => ({ kind: 'win', winner, by: 'line', cells: ['A1', 'B2', 'C3', 'D4'] }) as const;
  const square = (winner: 'A' | 'B') => ({ kind: 'win', winner, by: 'square', cells: ['B2', 'B3', 'C2', 'C3'] }) as const;
  const blockade = (winner: 'A' | 'B') => ({ kind: 'win', winner, by: 'blockade' }) as const;
  const draw = { kind: 'draw', by: 'full-board' } as const;

  const botCases: readonly [GameResult, string, string][] = [
    [line('A'), 'You win by a line', 'Your tokens on A1, B2, C3 and D4 make a line.'],
    [square('A'), 'You win by a square', 'Your tokens on B2, B3, C2 and C3 fill a 2×2 square.'],
    [blockade('A'), 'You win by blockade', 'No tile left on the board matches Forest–Star, so the bot cannot take one and loses.'],
    [line('B'), 'The bot wins by a line', "The bot's tokens on A1, B2, C3 and D4 make a line."],
    [square('B'), 'The bot wins by a square', "The bot's tokens on B2, B3, C2 and C3 fill a 2×2 square."],
    [blockade('B'), 'The bot wins by blockade', 'No tile left on the board matches Forest–Star, so you cannot take one and lose.'],
    [draw, 'Draw: the board is full', 'All 16 cells hold tokens and nobody made a line or a square.'],
  ];

  it.each(botCases)('names the result of a bot game and how it happened: %j', (result, summary, detail) => {
    expect(resultSummary(result, bot)).toBe(summary);
    expect(resultDetail({ result, lastTile: forest }, bot)).toBe(detail);
  });

  const pairCases: readonly [GameResult, string, string][] = [
    [line('A'), 'Player 1 wins by a line', "Player 1's tokens on A1, B2, C3 and D4 make a line."],
    [square('A'), 'Player 1 wins by a square', "Player 1's tokens on B2, B3, C2 and C3 fill a 2×2 square."],
    [blockade('A'), 'Player 1 wins by blockade', 'No tile left on the board matches Forest–Star, so Player 2 cannot take one and loses.'],
    [line('B'), 'Player 2 wins by a line', "Player 2's tokens on A1, B2, C3 and D4 make a line."],
    [square('B'), 'Player 2 wins by a square', "Player 2's tokens on B2, B3, C2 and C3 fill a 2×2 square."],
    [blockade('B'), 'Player 2 wins by blockade', 'No tile left on the board matches Forest–Star, so Player 1 cannot take one and loses.'],
    [draw, 'Draw: the board is full', 'All 16 cells hold tokens and nobody made a line or a square.'],
  ];

  it.each(pairCases)('names the winning seat of a two-player game and how it happened: %j', (result, summary, detail) => {
    expect(resultSummary(result, TWO_PLAYERS)).toBe(summary);
    expect(resultDetail({ result, lastTile: forest }, TWO_PLAYERS)).toBe(detail);
  });

  it('describes real finished games of every ending, in both modes', () => {
    for (const state of Object.values(endings())) {
      expect(resultSummary(state.result!, bot)).toMatch(/^(You win|The bot wins) by (a line|a square|blockade)$|^Draw: the board is full$/);
      expect(resultSummary(state.result!, TWO_PLAYERS)).toMatch(/^Player [12] wins by (a line|a square|blockade)$|^Draw: the board is full$/);
      expect(resultDetail(state, bot).length).toBeGreaterThan(20);
      expect(resultDetail(state, TWO_PLAYERS)).not.toMatch(/\b(you|bot)\b/i);
    }
    expect(resultDetail({ result: null, lastTile: null }, bot)).toBe('');
  });
});
