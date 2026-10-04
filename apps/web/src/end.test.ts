import { describe, expect, it } from 'vitest';
import { ALL_CELLS, LINES, SQUARES, type CellId, type GameResult, type Player } from '@okiya/game';
import { boardModel } from './boardModel';
import { endModel, endShrinking, END_SHRINK_LIMIT_MS, liftOrder } from './end';
import { matchCardModel } from './matchCard';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings, handBuilt } from './playouts.test-helper';

const modes = [versusBot('normal'), TWO_PLAYERS] as const;

/** A hand-built finished game: the given tokens on the board in cell order, and its result. */
function finished(tokens: readonly (Player | null)[], result: GameResult, lastTile = { terrain: 'Desert', symbol: 'Star' } as const) {
  return handBuilt(tokens, result.kind === 'win' ? (result.winner === 'A' ? 'B' : 'A') : 'A', lastTile, { result });
}

/** Tokens for `winner` on `cells` and one stray token for the other player on A4 (or A1). */
function tokensOn(cells: readonly CellId[], winner: Player): (Player | null)[] {
  const tokens: (Player | null)[] = ALL_CELLS.map((cell) => (cells.includes(cell) ? winner : null));
  const stray = ALL_CELLS.findIndex((cell, index) => tokens[index] === null && (cell === 'A4' || cell === 'A1' || cell === 'D4'));
  tokens[stray] = winner === 'A' ? 'B' : 'A';
  return tokens;
}

describe('end sequence model (PRD U10)', () => {
  it('lifts a line from end to end and a square round its loop', () => {
    expect(liftOrder('line', ['D1', 'A4', 'C2', 'B3'])).toEqual(['A4', 'B3', 'C2', 'D1']);
    expect(liftOrder('line', ['B4', 'B1', 'B3', 'B2'])).toEqual(['B1', 'B2', 'B3', 'B4']);
    expect(liftOrder('line', ['D3', 'A3', 'C3', 'B3'])).toEqual(['A3', 'B3', 'C3', 'D3']);
    expect(liftOrder('square', ['C3', 'B2', 'B3', 'C2'])).toEqual(['B2', 'B3', 'C3', 'C2']);
  });

  it('has no end sequence while the game runs', () => {
    expect(endModel(afterTakes(5, 4))).toBeNull();
    expect(boardModel(afterTakes(5, 4), { mode: TWO_PLAYERS, highlights: true }).cells.some((view) => view.end !== null || view.liftOrder !== null)).toBe(false);
  });

  const shapes: [string, 'line' | 'square', readonly CellId[]][] = [
    ['a row', 'line', LINES.find((line) => line.every((cell) => cell.startsWith('C')))!],
    ['a column', 'line', LINES.find((line) => line.every((cell) => cell.endsWith('2')))!],
    ['a diagonal', 'line', LINES.find((line) => line.includes('A4') && line.includes('D1'))!],
    ['a square', 'square', SQUARES.find((square) => square.includes('B2') && square.includes('C3'))!],
  ];

  for (const winner of ['A', 'B'] as const) {
    it.each(shapes)(`for a win by %s of seat ${winner}, lifts its four tokens in order and dims every other cell, in both modes`, (_name, by, cells) => {
      const state = finished(tokensOn(cells, winner), { kind: 'win', winner, by, cells });
      const end = endModel(state)!;
      expect(end.kind).toBe('shape');
      expect(end.lifts).toEqual(liftOrder(by, cells));
      expect(end.dims).toEqual(ALL_CELLS.filter((cell) => !cells.includes(cell)));
      expect(end.greys).toEqual([]);
      expect(end.matchText).toBeNull();
      for (const mode of modes) {
        const model = boardModel(state, { mode, highlights: true });
        for (const view of model.cells) {
          const order = end.lifts.indexOf(view.cell);
          expect(view.end).toBe(order >= 0 ? 'lift' : 'dim');
          expect(view.liftOrder).toBe(order >= 0 ? order : null);
        }
        expect(model.cells.filter((view) => view.liftOrder !== null).map((view) => view.liftOrder).sort()).toEqual([0, 1, 2, 3]);
        expect(matchCardModel(state).blocked).toBeNull();
      }
    });

    it(`for a blockade won by seat ${winner}, greys out every free tile, leaves the tokens, and says no tile matches, in both modes`, () => {
      const tokens: (Player | null)[] = ALL_CELLS.map((_, index) => (index < 9 ? (index % 2 === 0 ? winner : winner === 'A' ? 'B' : 'A') : null));
      const state = finished(tokens, { kind: 'win', winner, by: 'blockade' });
      const end = endModel(state)!;
      expect(end.kind).toBe('blockade');
      expect(end.lifts).toEqual([]);
      expect(end.dims).toEqual([]);
      expect(end.greys).toEqual(ALL_CELLS.slice(9));
      expect(end.matchText).toBe('No tile matches Desert–Star');
      for (const mode of modes) {
        const model = boardModel(state, { mode, highlights: true });
        expect(model.cells.filter((view) => view.end === 'grey').map((view) => view.cell)).toEqual(ALL_CELLS.slice(9));
        expect(model.cells.filter((view) => view.token !== null).every((view) => view.end === null)).toBe(true);
        expect(model.cells.some((view) => view.liftOrder !== null)).toBe(false);
      }
      expect(matchCardModel(state)).toMatchObject({ blocked: 'No tile matches Desert–Star', label: 'No tile matches Desert–Star' });
    });
  }

  it('settles every cell evenly after a draw, in both modes, with nothing lifting, dimming or greying', () => {
    const tokens = ALL_CELLS.map((_, index) => (index % 3 === 0 ? 'A' : 'B') as Player);
    const state = finished(tokens, { kind: 'draw', by: 'full-board' });
    const end = endModel(state)!;
    expect(end).toMatchObject({ kind: 'draw', lifts: [], dims: [], greys: [], matchText: null });
    for (const mode of modes) expect(boardModel(state, { mode, highlights: true }).cells.every((view) => view.end === 'settle' && view.liftOrder === null)).toBe(true);
  });

  it('agrees with the engine’s results on real games of every ending', () => {
    for (const [by, state] of Object.entries(endings())) {
      const end = endModel(state)!;
      const result = state.result!;
      if (result.kind === 'win' && (result.by === 'line' || result.by === 'square')) {
        expect([...end.lifts].sort()).toEqual([...result.cells].sort());
        expect(end.dims).toHaveLength(12);
      } else if (by === 'blockade') {
        expect(end.greys).toEqual(ALL_CELLS.filter((cell, index) => state.tokens[index] === null && cell));
        expect(end.matchText).toMatch(/^No tile matches [A-Za-z]+–[A-Za-z]+$/);
      } else {
        expect(end.kind).toBe('draw');
      }
    }
  });
});

describe('the phone’s end shrink (PRD U6, U10)', () => {
  it('runs only for a game that ends on screen, until it is done, never for a game shown ended', () => {
    expect(endShrinking(false, false, false)).toBe(false);
    expect(endShrinking(true, false, false)).toBe(true);
    expect(endShrinking(true, false, true)).toBe(false);
    expect(endShrinking(true, true, false)).toBe(false);
    // Its mark lasts no longer than the end sequence (PRD U10).
    expect(END_SHRINK_LIMIT_MS).toBeLessThanOrEqual(700);
  });
});
