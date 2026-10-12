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
  howToPages,
  INTRO_TEXT,
  introShows,
  MATCHING_EXAMPLE,
  rememberIntroSeen,
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
    expect(text('taking')).toContain('Hold a tile to read its name.');
    // One short paragraph, so the example and its board show without scrolling on a phone.
    expect(pages[0]!.paragraphs).toHaveLength(1);
    expect(text('taking').length).toBeLessThanOrEqual(260);
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
    expect(html).toContain('To match: <strong>Forest–Star</strong>');
    expect(html).toContain('✓ same terrain');
    expect(html).toContain('✓ same symbol');
    expect(html).toContain('✗ no match');
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
    expect(DIAGRAMS.matching.caption).toContain('Forest–Star');
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

  it('shows the matching example on the diagram’s own board: the same last tile, and tiles still free there, glowing exactly when they match', () => {
    const state = diagramState(DIAGRAMS.matching);
    expect(MATCHING_EXAMPLE.lastTile).toEqual(state.lastTile);
    const cells = diagramCells(DIAGRAMS.matching);
    for (const tile of MATCHING_EXAMPLE.tiles) {
      const view = cells.find((cell) => tileName(cell.tile) === tileName(tile))!;
      expect(view.token, tileName(tile)).toBeNull();
      expect(view.mark, tileName(tile)).toBe(tile.matches ? 'glow' : 'dead');
    }
  });
});

describe('first-game intro', () => {
  it('shows only until a newcomer was taught, and not when storage fails; How to Play never opens by itself', () => {
    const storage = memoryStorage();
    expect(introShows(storage)).toBe(true);
    expect(rememberIntroSeen(storage)).toBe(true);
    expect(storage.data.get(HOWTO_SEEN_KEY)).toBe('true');
    expect(introShows(storage)).toBe(false);
    expect(introShows(null)).toBe(false);
    // The playtest build's guide dismissal counts as taught.
    const legacy = memoryStorage();
    legacy.data.set('okiya.guide.dismissed', 'true');
    expect(introShows(legacy)).toBe(false);
  });

  it('is the one line of the rules a first game needs', () => {
    expect(INTRO_TEXT).toBe('Take an edge tile first. Then match terrain or symbol. Win with a line, a square, or no move left for your opponent.');
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
