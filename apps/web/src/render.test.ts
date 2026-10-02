import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalTakes, newGame, type GameState } from '@okiya/game';
import { boardModel } from './boardModel';
import { MatchScreen } from './MatchScreen';
import { afterTakes, endings } from './playouts.test-helper';
import { DEFAULT_SETTINGS } from './settings';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const renderMatch = (state: GameState, highlights = true) =>
  decode(
    renderToStaticMarkup(
      createElement(MatchScreen, { initialState: state, difficulty: 'normal', settings: { ...DEFAULT_SETTINGS, highlights }, onPlayAgain: () => {}, onLeave: () => {} }),
    ),
  );

describe('the tabletop match screen (PRD U1, U2)', () => {
  const state = afterTakes(4, 4);
  const html = renderMatch(state);

  it('renders the top bar and the board, and nothing else but the menu button and toasts', () => {
    for (const testId of ['top-bar', 'turn', 'last-tile', 'last-tile-terrain', 'last-tile-symbol', 'token-counts', 'tokens-you', 'tokens-bot', 'menu-button', 'board-frame', 'board', 'toasts']) {
      expect(html, testId).toContain(`data-testid="${testId}"`);
    }
    for (const testId of ['log', 'resolution', 'status', 'legend', 'settings', 'menu-settings', 'menu', 'end-screen', 'starter']) {
      expect(html, testId).not.toContain(`data-testid="${testId}"`);
    }
    for (const heading of ['Log', 'Last actions', 'Status', 'Settings', 'Legend']) expect(html).not.toMatch(new RegExp(`<h[1-6][^>]*>${heading}</h`));
  });

  it('names every cell by its tile or token, the legal takes and the last take (PRD U7)', () => {
    const model = boardModel(state, { human: 'A', highlights: true });
    expect(html.match(/role="gridcell"/g)).toHaveLength(16);
    for (const view of model.cells) expect(html).toContain(`aria-label="${view.label}"`);
    expect(html.match(/data-glow="true"/g)).toHaveLength(legalTakes(state).length);
    expect(html.match(/data-last="true"/g)).toHaveLength(1);
    expect(html.match(/data-testid="token"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Your tokens: 6 of 8 left"');
    expect(html).toContain('aria-label="Bot\'s tokens: 6 of 8 left"');
  });

  it('shows who starts and "Any edge tile" before the opening take', () => {
    const opening = renderMatch(newGame({ seed: 4, starter: 'B' }));
    expect(opening).toContain('data-testid="starter" data-starter="B">Bot starts</p>');
    expect(opening).toContain('Any edge tile');
    expect(opening).toContain('Bot is thinking');
  });

  it('makes nothing glow with highlights off', () => {
    expect(renderMatch(state, false)).not.toContain('data-glow="true"');
  });

  it.each(Object.entries(endings()))('shows the end screen beside the board after a %s, with the winning shape marked', (by, finished) => {
    const ended = renderMatch(finished);
    expect(ended).toContain('data-testid="end-screen"');
    expect(ended).toContain(`data-by="${by}"`);
    expect(ended).toMatch(/data-testid="result">(You win|The bot wins|Draw)/);
    expect(ended).toContain('Play again');
    expect(ended.match(/data-winning="true"/g) ?? []).toHaveLength(by === 'line' || by === 'square' ? 4 : 0);
    expect(ended).not.toContain('data-glow="true"');
  });
});
