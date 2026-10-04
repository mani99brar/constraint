import { describe, expect, it } from 'vitest';
import { ALL_CELLS, EDGE_CELLS, legalTakes, LINES, newGame, SQUARES, tileAt, tokenAt, type GameState } from '@okiya/game';
import { boardModel } from './boardModel';
import { TWO_PLAYERS, versusBot } from './mode';
import { afterTakes, endings, handBuilt } from './playouts.test-helper';
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

  describe('the legal-tile look (PRD R2, I2, E3)', () => {
    // Hand-built states on one board: three tokens, the last tile Water–Sun, and the player to move.
    const lastTile = { terrain: 'Water', symbol: 'Sun' } as const;
    const tokens = ['A', null, 'B', null, null, 'A'] as const;

    it.each([
      ['a bot game, your turn', bot, 'A'],
      ['a two-player game, Player 1 to move', TWO_PLAYERS, 'A'],
      ['a two-player game, Player 2 to move', TWO_PLAYERS, 'B'],
    ] as const)('in %s, marks the legal tiles to glow, the other free tiles to fade, and washes in the mover’s colour', (_name, mode, mover) => {
      const state = handBuilt(tokens, mover, lastTile);
      const legal = legalTakes(state);
      expect(legal.length).toBeGreaterThan(0);
      const model = boardModel(state, { mode, highlights: true });
      expect(model.cells.filter((view) => view.glow).map((view) => view.cell)).toEqual(legal);
      const free = model.cells.filter((view) => view.token === null);
      expect(model.cells.filter((view) => view.faded).map((view) => view.cell)).toEqual(free.filter((view) => !legal.includes(view.cell)).map((view) => view.cell));
      expect(model.cells.filter((view) => view.faded).length).toBeGreaterThan(0);
      // Taken cells never fade or glow; a cell never both glows and fades.
      for (const view of model.cells) {
        if (view.token !== null) expect([view.faded, view.glow]).toEqual([false, false]);
        expect(view.glow && view.faded).toBe(false);
      }
      expect(model.wash).toBe(mover);
      // The last take is the last cell in `takes` of the hand-built state.
      expect(model.cells.filter((view) => view.last).map((view) => view.cell)).toEqual([state.takes[state.takes.length - 1]]);
    });

    it('fades, lifts and washes nothing with highlights off, in both modes', () => {
      for (const [mode, mover] of [
        [bot, 'A'],
        [TWO_PLAYERS, 'B'],
      ] as const) {
        const model = boardModel(handBuilt(tokens, mover, lastTile), { mode, highlights: false });
        expect(model.cells.some((view) => view.glow || view.faded)).toBe(false);
        expect(model.wash).toBeNull();
        expect(model.cells.filter((view) => view.last)).toHaveLength(1);
      }
    });

    it('fades, lifts and washes nothing while the bot chooses, so the board stays still on its turn', () => {
      const model = boardModel(handBuilt(tokens, 'B', lastTile), on);
      expect(model.acceptsTakes).toBe(false);
      expect(model.cells.some((view) => view.glow || view.faded)).toBe(false);
      expect(model.wash).toBeNull();
      expect(model.active).toBe('B');
    });

    it('fades nothing at the end of a game, in either mode', () => {
      for (const finished of Object.values(endings())) {
        for (const options of [on, pair]) {
          const model = boardModel(finished, options);
          expect(model.cells.some((view) => view.glow || view.faded)).toBe(false);
          expect(model.wash).toBeNull();
          expect(model.end).not.toBeNull();
        }
      }
    });

    it('names every free cell by its tile and keeps a taken cell’s name to its token', () => {
      const state = handBuilt(tokens, 'A', lastTile);
      const model = boardModel(state, on);
      for (const view of model.cells) {
        if (view.token === null) expect(view.label).toContain(tileName(view.tile));
        else expect(view.label).not.toContain(tileName(view.tile));
      }
      expect(model.cells[0]!.label).toBe('A1, your token');
    });

    it('carries the Tile names setting, off by default', () => {
      const state = handBuilt(tokens, 'A', lastTile);
      expect(boardModel(state, on).names).toBe(false);
      expect(boardModel(state, { ...on, tileNames: true }).names).toBe(true);
    });
  });
});
