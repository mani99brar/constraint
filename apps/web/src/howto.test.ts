import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_CELLS, EDGE_CELLS, legalTakes, LINES, SQUARES, TILES, tilesMatch, type GameState } from '@okiya/game';
import { restoreFocus, wrapFocus, type Focusable } from './focus';
import { HowToPlay } from './HowToPlay';
import {
  DIAGRAM_BOARD,
  DIAGRAM_START,
  diagramCells,
  diagramMover,
  diagramState,
  DIAGRAMS,
  HOWTO_SEEN_KEY,
  howToOpensFirst,
  howToPages,
  MATCHING_EXAMPLE,
  rememberHowToSeen,
  type Diagram,
} from './howto';
import type { KeyValueStorage } from './storage';
import { tileName } from './text';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

const html = decode(renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, returnFocusTo: null })));
const pages = howToPages();
const text = (id: string) => pages.find((page) => page.id === id)!.paragraphs.join(' ');
const marked = (diagram: Diagram, mark: string) => diagramCells(diagram).filter((cell) => cell.mark === mark).map((cell) => cell.cell);
const free = (state: GameState) => ALL_CELLS.filter((_, index) => state.tokens[index] === null);

describe('How to Play pages (PRD E2)', () => {
  it('is a labelled modal dialog with a close button, opening on its first page', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="howto-title"');
    expect(html).toContain('aria-label="Close How to play"');
    expect(html).toContain('data-section="taking"');
    expect(html).toContain('Page 1 of 5');
    expect(html).toContain('>Next</button>');
  });

  it('has its pages in order: taking a matching tile, the opening, lines and squares, the blockade and the full-board draw', () => {
    expect(pages.map((page) => page.id)).toEqual(['taking', 'opening', 'shapes', 'blockade', 'draw']);
    expect(text('taking')).toContain('same terrain or the same symbol');
    expect(text('taking')).toContain('Match card');
    expect(text('opening')).toContain('any tile on the edge');
    expect(text('shapes')).toMatch(/row.*column.*diagonal.*2×2 square/);
    expect(text('blockade')).toContain('no tile left on the board matches the last tile');
    expect(text('draw')).toContain('all 16 cells');
    expect(pages.map((page) => page.diagrams.map((diagram) => diagram.id))).toEqual([['matching'], ['opening'], ['line', 'square'], ['blockade'], ['draw']]);
  });

  it('assumes no bot opponent: the wording fits both modes', () => {
    for (const page of pages) {
      for (const words of [page.title, ...page.paragraphs, ...page.diagrams.map((diagram) => diagram.caption)]) expect(words, page.id).not.toMatch(/\bbots?\b/i);
    }
    expect(html).not.toMatch(/\bbots?\b/i);
  });

  it('illustrates matching with a tile of each kind, drawn with the tile art', () => {
    for (const tile of MATCHING_EXAMPLE.tiles) expect(tilesMatch(tile, MATCHING_EXAMPLE.lastTile)).toBe(tile.matches);
    expect(html).toContain('To match: <strong>Forest–Moon</strong>');
    expect(html).toContain('✓ matches (same terrain)');
    expect(html).toContain('✓ matches (same symbol)');
    expect(html).toContain('✗ no match (neither)');
    expect(html.match(/data-testid="matching-example"[\s\S]*?<\/figure>/)![0].match(/class="tile-art /g)).toHaveLength(4);
  });
});

describe('How to Play diagrams agree with the rules (spec §1–§4)', () => {
  it('are drawn on a board of the 16 real tiles, one of each', () => {
    expect(DIAGRAM_BOARD).toHaveLength(16);
    expect(new Set(DIAGRAM_BOARD.map(tileName))).toEqual(new Set(TILES.map(tileName)));
    expect(legalTakes(DIAGRAM_START)).toEqual(EDGE_CELLS);
  });

  it('are real games: every take is legal when replayed by the engine', () => {
    for (const diagram of Object.values(DIAGRAMS)) expect(() => diagramState(diagram), diagram.id).not.toThrow();
  });

  it('show the tile art on every free cell and a token on every taken one', () => {
    for (const diagram of Object.values(DIAGRAMS)) {
      const state = diagramState(diagram);
      for (const view of diagramCells(diagram)) {
        expect(view.tile).toEqual(DIAGRAM_BOARD[ALL_CELLS.indexOf(view.cell)]);
        expect(view.token).toBe(state.tokens[ALL_CELLS.indexOf(view.cell)]);
      }
    }
    // One tile-art drawing per free cell of the first page's diagram, besides the matching example.
    const first = decode(renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, returnFocusTo: null })));
    const matching = first.match(/data-testid="diagram-matching"[\s\S]*?<\/figure>/)![0];
    expect(matching.match(/class="tile-art /g)).toHaveLength(free(diagramState(DIAGRAMS.matching)).length);
  });

  it('make the matching tiles glow and mark the rest as not matching', () => {
    const state = diagramState(DIAGRAMS.matching);
    expect(state.result).toBeNull();
    expect(tileName(state.lastTile!)).toBe('Forest–Star');
    expect(marked(DIAGRAMS.matching, 'glow')).toEqual(legalTakes(state));
    expect(marked(DIAGRAMS.matching, 'glow').length).toBeGreaterThan(0);
    expect(marked(DIAGRAMS.matching, 'dead')).toEqual(free(state).filter((cell) => !legalTakes(state).includes(cell)));
  });

  it('make the 12 edge tiles glow at the opening', () => {
    expect(marked(DIAGRAMS.opening, 'glow')).toEqual(EDGE_CELLS);
  });

  it('end with a real line and a real square for the taker', () => {
    const line = diagramState(DIAGRAMS.line).result!;
    expect(line).toMatchObject({ kind: 'win', winner: 'A', by: 'line' });
    expect(LINES.some((shape) => shape.join() === marked(DIAGRAMS.line, 'shape').join())).toBe(true);
    const square = diagramState(DIAGRAMS.square).result!;
    expect(square).toMatchObject({ kind: 'win', winner: 'A', by: 'square' });
    expect(SQUARES.some((shape) => [...shape].sort().join() === [...marked(DIAGRAMS.square, 'shape')].sort().join())).toBe(true);
  });

  it('end the blockade with no matching tile left for the next player', () => {
    const state = diagramState(DIAGRAMS.blockade);
    expect(state.result).toEqual({ kind: 'win', winner: 'A', by: 'blockade' });
    expect(marked(DIAGRAMS.blockade, 'last')).toEqual(['C2']);
    expect(tileName(state.lastTile!)).toBe('Forest–Wave');
    expect(DIAGRAMS.blockade.caption).toContain('Forest–Wave at C2');
    expect(marked(DIAGRAMS.blockade, 'dead')).toEqual(free(state));
    for (const cell of free(state)) expect(tilesMatch(DIAGRAM_BOARD[ALL_CELLS.indexOf(cell)]!, state.lastTile!)).toBe(false);
  });

  it('end the draw on a full board, 8 tokens each, with no shape', () => {
    const state = diagramState(DIAGRAMS.draw);
    expect(state.result).toEqual({ kind: 'draw', by: 'full-board' });
    expect(state.tokens.filter((token) => token === 'A')).toHaveLength(8);
    expect(state.tokens.filter((token) => token === 'B')).toHaveLength(8);
  });

  it('opens by itself only on the very first visit, and not when storage fails', () => {
    const storage = memoryStorage();
    expect(howToOpensFirst(storage)).toBe(true);
    expect(rememberHowToSeen(storage)).toBe(true);
    expect(storage.data.get(HOWTO_SEEN_KEY)).toBe('true');
    expect(howToOpensFirst(storage)).toBe(false);
    expect(howToOpensFirst(null)).toBe(false);
  });
});

describe('How to Play focus (PRD U7, E2)', () => {
  const [close, body, gotIt] = ['close', 'body', 'got-it'];
  const items = [close, body, gotIt];

  it('traps Tab inside the dialog in both directions', () => {
    expect(wrapFocus(items, gotIt, false)).toBe(close);
    expect(wrapFocus(items, close, true)).toBe(gotIt);
    expect(wrapFocus(items, close, false)).toBeNull();
    expect(wrapFocus(items, body, true)).toBeNull();
    expect(wrapFocus(items, 'outside', false)).toBe(close);
    expect(wrapFocus(items, null, true)).toBe(gotIt);
    expect(wrapFocus([], close, false)).toBeNull();
  });

  it('returns focus to the button that opened it, when still on the page', () => {
    const focused: string[] = [];
    const opener: Focusable = { isConnected: true, focus: () => void focused.push('opener') };
    expect(restoreFocus(opener)).toBe(true);
    expect(focused).toEqual(['opener']);
    expect(restoreFocus({ isConnected: false, focus: () => void focused.push('gone') })).toBe(false);
    expect(restoreFocus(null)).toBe(false);
    expect(focused).toEqual(['opener']);
  });
});

describe('the diagrams’ glow (PRD R2)', () => {
  it('glows in the colour of the diagram’s player to move: Player 2 after the matching example’s three takes', () => {
    expect(diagramMover(DIAGRAMS.matching)).toBe('B');
    expect(diagramMover(DIAGRAMS.opening)).toBe('A');
    const html = renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, returnFocusTo: null }));
    expect(html).toMatch(/class="mini-board"[^>]*data-glow-player="B"/);
  });
});
