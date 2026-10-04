import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalTakes, newGame, type GameState } from '@okiya/game';
import { turnAnnouncement } from './announce';
import { boardModel } from './boardModel';
import { MatchScreen } from './MatchScreen';
import { TWO_PLAYERS, versusBot, type GameMode } from './mode';
import { afterTakes, endings } from './playouts.test-helper';
import { NO_SCORE, type Score } from './score';
import { DEFAULT_SETTINGS } from './settings';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const normal = versusBot('normal');

const renderMatch = (state: GameState, { mode = normal, highlights = true, score = NO_SCORE }: { mode?: GameMode; highlights?: boolean; score?: Score } = {}) =>
  decode(renderToStaticMarkup(createElement(MatchScreen, { initialState: state, mode, score, settings: { ...DEFAULT_SETTINGS, highlights }, onPlayAgain: () => {}, onLeave: () => {} })));

describe('the match screen (PRD U1, U2, §5.8)', () => {
  const state = afterTakes(4, 4);
  const html = renderMatch(state);

  it('renders the seats, the board, the Match card and a top bar holding only the menu button, and no panel', () => {
    for (const testId of ['top-bar', 'match-card', 'match-card-terrain', 'match-card-symbol', 'menu-button', 'seat-A', 'seat-B', 'avatar-A', 'avatar-B', 'board-frame', 'board', 'toasts', 'announcer', 'sitting-score']) {
      expect(html, testId).toContain(`data-testid="${testId}"`);
    }
    for (const testId of ['log', 'resolution', 'status', 'legend', 'settings', 'menu-settings', 'menu', 'end-screen', 'turn', 'last-tile', 'token-counts']) {
      expect(html, testId).not.toContain(`data-testid="${testId}"`);
    }
    const bar = /<header class="top-bar"[\s\S]*?<\/header>/.exec(html)![0];
    expect(bar.match(/<button/g)).toHaveLength(1);
    expect(bar).toContain('data-testid="match-card"');
    for (const heading of ['Log', 'Last actions', 'Status', 'Settings', 'Legend']) expect(html).not.toMatch(new RegExp(`<h[1-6][^>]*>${heading}</h`));
  });

  it('keeps the seats out of the Tab order: they hold no button or link', () => {
    for (const player of ['A', 'B']) {
      const seat = new RegExp(`<section[^>]*data-testid="seat-${player}"[\\s\\S]*?</section>`).exec(html)![0];
      expect(seat).not.toMatch(/<button|<a |tabindex/);
    }
  });

  it('names every cell by its tile or token, the legal takes and the last take (PRD U7)', () => {
    const model = boardModel(state, { mode: normal, highlights: true });
    expect(html.match(/role="gridcell"/g)).toHaveLength(16);
    for (const view of model.cells) expect(html).toContain(`aria-label="${view.label}"`);
    expect(html.match(/data-glow="true"/g)).toHaveLength(legalTakes(state).length);
    expect(html.match(/data-last="true"/g)).toHaveLength(1);
    expect(html.match(/data-testid="token"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="6 of 8 tokens left"');
    expect(html).not.toContain('glow-dot');
  });

  it('lights the seat to move with its label, and dims the other', () => {
    expect(html).toMatch(/class="seat seat-p1 lit"[^>]*data-lit="true"/);
    expect(html).toMatch(/class="seat seat-p2 dimmed"[^>]*data-lit="false"/);
    expect(html).toContain('data-testid="seat-A-status">Your move</p>');
    expect(html).toContain('data-testid="seat-B-name">Bot · Normal</h2>');
    expect(html).toContain(`data-testid="announcer">${turnAnnouncement(state, normal)}</p>`);
    expect(html).toContain('data-active="A"');
    expect(html).toContain('data-glow-player="A"');
  });

  it('shows who starts, "Any edge tile" before the opening take, and the bot thinking', () => {
    const opening = renderMatch(newGame({ seed: 4, starter: 'B' }));
    expect(opening).toContain('data-starter="B"');
    expect(opening).toContain('Any edge tile');
    expect(opening).toContain('data-testid="seat-B-status">Bot is thinking</p>');
    expect(opening).toContain('The bot starts. Bot is thinking.');
  });

  it('seats Player 1 and Player 2 in a two-player game, the glow following the player to move', () => {
    const two = renderMatch(afterTakes(4, 3), { mode: TWO_PLAYERS, score: { A: 2, B: 1, draws: 1 } });
    expect(two).toContain('data-testid="seat-A-name">Player 1</h2>');
    expect(two).toContain('data-testid="seat-B-name">Player 2</h2>');
    expect(two).toContain(`data-testid="seat-B-status">Player 2's move</p>`);
    expect(two).toContain('data-glow-player="B"');
    expect(two).toContain('data-active="B"');
    expect(two).toContain('Player 1 2 – 1 Player 2 · 1 draw');
    expect(two).toMatch(/data-testid="seat-A"[^>]*data-score="2"/);
    expect(two).toMatch(/aria-label="[A-D]\d, Player [12]'s token/);
    expect(two).not.toMatch(/your token|bot's token/);
  });

  it('makes nothing glow with highlights off', () => {
    expect(renderMatch(state, { highlights: false })).not.toContain('data-glow="true"');
    expect(renderMatch(state, { highlights: false })).not.toContain('data-glow-player');
  });

  it.each(Object.entries(endings()))('shows the end screen once after a %s, with the stroke across a winning shape and the faces of the result', (by, finished) => {
    for (const mode of [normal, TWO_PLAYERS]) {
      const ended = renderMatch(finished, { mode });
      expect(ended.match(/data-testid="end-screen"/g)).toHaveLength(1);
      expect(ended).toContain(`data-by="${by}"`);
      expect(ended).toMatch(mode === normal ? /data-testid="result">(You win|The bot wins|Draw)/ : /data-testid="result">(Player [12] wins|Draw)/);
      expect(ended).toContain('Play again');
      expect(ended).toContain('Title screen');
      expect(ended).not.toContain('data-kind="end"');
      expect(ended.match(/data-winning="true"/g) ?? []).toHaveLength(by === 'line' || by === 'square' ? 4 : 0);
      expect(ended.includes('data-testid="win-stroke"')).toBe(by === 'line' || by === 'square');
      expect(ended).not.toContain('data-glow="true"');
      expect(ended).not.toContain('data-lit="true"');
      const result = finished.result!;
      const faces = [...ended.matchAll(/data-testid="seat-[AB]"[^>]*data-expression="([a-z-]+)"/g)].map((match) => match[1]);
      expect(faces).toEqual(result.kind === 'draw' ? ['idle', 'idle'] : result.winner === 'A' ? ['won', 'lost'] : ['lost', 'won']);
    }
  });
});
