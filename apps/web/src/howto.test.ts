import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_CELLS, EDGE_CELLS, LINES, SQUARES, tilesMatch, type CellId } from '@okiya/game';
import { restoreFocus, wrapFocus, type Focusable } from './focus';
import { HowToPlay } from './HowToPlay';
import { DIAGRAMS, HOWTO_SEEN_KEY, howToOpensFirst, howToSections, MATCHING_EXAMPLE, rememberHowToSeen, type Diagram } from './howto';
import type { KeyValueStorage } from './storage';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

const html = decode(renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, returnFocusTo: null })));
const sections = howToSections();
const text = (id: string) => sections.find((section) => section.id === id)!.paragraphs.join(' ');

const cellsWith = (diagram: Diagram, test: (view: NonNullable<Diagram['cells'][CellId]>) => boolean) =>
  ALL_CELLS.filter((cell) => {
    const view = diagram.cells[cell];
    return view !== undefined && test(view);
  });

/** Whether a player's tokens on a diagram make any line or square. */
function hasShape(diagram: Diagram, token: 'you' | 'bot'): boolean {
  const owned = new Set(cellsWith(diagram, (view) => view.token === token));
  return [...LINES, ...SQUARES].some((shape) => shape.every((cell) => owned.has(cell)));
}

describe('How to Play content (PRD E2)', () => {
  it('is a labelled modal dialog with a close button', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="howto-title"');
    expect(html).toContain('aria-label="Close How to play"');
  });

  it('explains taking a matching tile, the edge opening, lines and squares, the blockade and the full-board draw', () => {
    expect(sections.map((section) => section.id)).toEqual(['taking', 'opening', 'shapes', 'blockade', 'draw']);
    expect(text('taking')).toContain('same terrain or the same symbol');
    expect(text('taking')).toContain('last tile');
    expect(text('opening')).toContain('any tile on the edge');
    expect(text('shapes')).toMatch(/row.*column.*diagonal.*2×2 square/);
    expect(text('blockade')).toContain('no tile left on the board matches the last tile');
    expect(text('draw')).toContain('all 16 cells');
    for (const section of sections) expect(html).toContain(`data-section="${section.id}"`);
  });

  it('illustrates matching with a tile of each kind', () => {
    for (const tile of MATCHING_EXAMPLE.tiles) expect(tilesMatch(tile, MATCHING_EXAMPLE.lastTile)).toBe(tile.matches);
    expect(html).toContain('Last tile: <strong>Forest–Moon</strong>');
    expect(html).toContain('✓ matches (same terrain)');
    expect(html).toContain('✓ matches (same symbol)');
    expect(html).toContain('✗ no match (neither)');
  });

  it('draws a small board diagram for the opening, a line, a square, a blockade and a draw, true to the rules', () => {
    for (const diagram of Object.values(DIAGRAMS)) {
      expect(html).toContain(`data-testid="diagram-${diagram.id}"`);
      expect(html).toContain(diagram.caption);
    }
    expect(html.match(/class="mini-cell/g)).toHaveLength(16 * Object.keys(DIAGRAMS).length);
    expect(cellsWith(DIAGRAMS.opening, (view) => view.mark === 'glow')).toEqual(EDGE_CELLS);
    const line = cellsWith(DIAGRAMS.line, (view) => view.mark === 'shape');
    expect(LINES.some((shape) => shape.join() === line.join())).toBe(true);
    const square = cellsWith(DIAGRAMS.square, (view) => view.mark === 'shape');
    expect(SQUARES.some((shape) => [...shape].sort().join() === [...square].sort().join())).toBe(true);
    expect(hasShape(DIAGRAMS.line, 'bot') || hasShape(DIAGRAMS.square, 'bot')).toBe(false);
    // The blockade: no shape, the last take marked, and only tiles that do not match left.
    expect(hasShape(DIAGRAMS.blockade, 'you') || hasShape(DIAGRAMS.blockade, 'bot')).toBe(false);
    expect(cellsWith(DIAGRAMS.blockade, (view) => view.mark === 'last')).toHaveLength(1);
    expect(cellsWith(DIAGRAMS.blockade, (view) => view.token === undefined)).toEqual(cellsWith(DIAGRAMS.blockade, (view) => view.mark === 'dead'));
    // The draw: a full board, 8 tokens each, and no shape for either player.
    expect(cellsWith(DIAGRAMS.draw, (view) => view.token === 'you')).toHaveLength(8);
    expect(cellsWith(DIAGRAMS.draw, (view) => view.token === 'bot')).toHaveLength(8);
    expect(hasShape(DIAGRAMS.draw, 'you') || hasShape(DIAGRAMS.draw, 'bot')).toBe(false);
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
