import { describe, expect, it } from 'vitest';
import { ALL_CELLS, EDGE_CELLS, legalTakes, LINES, newGame, SQUARES, tileAt, tokenAt, type GameState } from '@okiya/game';
import { boardModel } from './boardModel';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings } from './playouts.test-helper';
import { tileName } from './text';

const bot = versusBot('normal');
const on = { mode: bot, highlights: true } as const;
const off = { mode: bot, highlights: false } as const;
const pair = { mode: TWO_PLAYERS, highlights: true } as const;

describe('board model (PRD U1, R2, I2, R4, U7)', () => {
  it('gives every cell its tile while it is on the board, and the taker’s token once taken', () => {
    for (const takes of [0, 1, 5, 9]) {
      const state = afterTakes(17, takes);
      const model = boardModel(state, on);
      expect(model.cells.map((view) => view.cell)).toEqual(ALL_CELLS);
      for (const view of model.cells) {
        expect(view.tile).toEqual(tileAt(state, view.cell));
        expect(view.token).toBe(tokenAt(state, view.cell));
        expect(view.label).toBe(
          [view.cell, view.token === null ? tileName(view.tile) : view.token === 'A' ? 'your token' : "bot's token"]
            .concat(view.glow ? ['legal take'] : [], view.last ? ['last take'] : [])
            .join(', '),
        );
      }
      expect(model.cells.filter((view) => view.token !== null)).toHaveLength(takes);
    }
  });

  it('names cells by the seat in a two-player game: "B3, Player 2\'s token"', () => {
    const state = afterTakes(17, 6);
    const model = boardModel(state, pair);
    for (const view of model.cells.filter((cell) => cell.token !== null)) {
      expect(view.label).toMatch(new RegExp(`^${view.cell}, Player ${view.token === 'A' ? 1 : 2}'s token`));
    }
    expect(model.cells.some((view) => /your|bot/.test(view.label))).toBe(false);
  });

  it('makes exactly the legal takes glow on the human’s turn, in Player 1’s colour: the 12 edge tiles at the opening, then the matching tiles', () => {
    const opening = newGame({ seed: 3, starter: 'A' });
    expect(boardModel(opening, on).glowing).toEqual(legalTakes(opening));
    expect(boardModel(opening, on).glowing).toEqual(EDGE_CELLS);
    expect(boardModel(opening, on).active).toBe('A');
    for (const takes of [2, 4, 6, 8]) {
      const state = afterTakes(29, takes);
      expect(state.toMove).toBe('A');
      const model = boardModel(state, on);
      expect(model.acceptsTakes).toBe(true);
      expect(model.active).toBe('A');
      expect(model.glowing).toEqual(legalTakes(state));
      expect(model.cells.filter((view) => view.glow).map((view) => view.cell)).toEqual(legalTakes(state));
      expect(model.cells.filter((view) => view.legal).map((view) => view.cell)).toEqual(legalTakes(state));
    }
  });

  it('makes the legal takes glow for both seats of a two-player game, in the colour of the player to move', () => {
    for (const takes of [0, 1, 2, 3, 4, 5]) {
      const state = afterTakes(29, takes, 'B');
      const model = boardModel(state, pair);
      expect(model.acceptsTakes).toBe(true);
      expect(model.active).toBe(state.toMove);
      expect(model.glowing).toEqual(legalTakes(state));
    }
  });

  it('makes nothing glow with highlights off, though the legal takes and the active colour stay known', () => {
    for (const mode of [bot, TWO_PLAYERS]) {
      const state = afterTakes(29, 4);
      const model = boardModel(state, { mode, highlights: false });
      expect(model.glowing).toEqual([]);
      expect(model.cells.some((view) => view.glow)).toBe(false);
      expect(model.cells.filter((view) => view.legal).map((view) => view.cell)).toEqual(legalTakes(state));
      expect(model.cells.some((view) => view.label.includes('legal take'))).toBe(false);
      expect(model.active).toBe('A');
    }
    expect(boardModel(afterTakes(29, 4), off).glowing).toEqual([]);
  });

  it('makes nothing glow and accepts no take during the bot’s turn, while the frame takes the bot’s colour', () => {
    const state = afterTakes(29, 3);
    expect(state.toMove).toBe('B');
    const model = boardModel(state, on);
    expect(model.acceptsTakes).toBe(false);
    expect(model.glowing).toEqual([]);
    expect(model.active).toBe('B');
  });

  it('marks the latest take, and only it, until the next one', () => {
    expect(boardModel(newGame({ seed: 8 }), on).cells.some((view) => view.last)).toBe(false);
    for (let takes = 1; takes <= 7; takes += 1) {
      const state = afterTakes(8, takes);
      const marked = boardModel(state, pair).cells.filter((view) => view.last);
      expect(marked.map((view) => view.cell)).toEqual([state.takes[takes - 1]]);
      expect(marked[0]!.label).toContain('last take');
    }
  });

  const ended = endings();

  it.each(['line', 'square'] as const)('marks the four cells of a winning %s at the end, and only them, for the stroke', (by) => {
    const state = ended[by];
    expect(state.result).toMatchObject({ kind: 'win', by });
    const cells = state.result!.kind === 'win' && state.result!.by !== 'blockade' ? state.result!.cells : [];
    expect((by === 'line' ? LINES : SQUARES).some((shape) => shape.join() === cells.join())).toBe(true);
    for (const options of [on, pair]) {
      const model = boardModel(state, options);
      expect(model.cells.filter((view) => view.winning).map((view) => view.cell)).toEqual([...cells].sort((a, b) => ALL_CELLS.indexOf(a) - ALL_CELLS.indexOf(b)));
      for (const view of model.cells.filter((cell) => cell.winning)) expect(view.label).toContain(`winning ${by}`);
      expect(model.winningShape).toEqual({ by, cells });
      expect(model.acceptsTakes).toBe(false);
      expect(model.glowing).toEqual([]);
      expect(model.active).toBeNull();
    }
  });

  it.each(['blockade', 'full-board'] as const)('marks no shape after a %s', (by) => {
    const state: GameState = ended[by];
    expect(state.result?.by).toBe(by);
    expect(boardModel(state, on).cells.some((view) => view.winning)).toBe(false);
    expect(boardModel(state, on).winningShape).toBeNull();
  });
});
