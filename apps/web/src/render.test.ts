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
import { App } from './App';
import { homeModel } from './home';
import { HomeScreen } from './HomeScreen';
import { emptyResults } from './results';
import { saveGame } from './save';
import type { KeyValueStorage } from './storage';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const normal = versusBot('normal');

const renderMatch = (state: GameState, { mode = normal, highlights = true, tileNames = false, score = NO_SCORE }: { mode?: GameMode; highlights?: boolean; tileNames?: boolean; score?: Score } = {}) =>
  decode(renderToStaticMarkup(createElement(MatchScreen, { initialState: state, mode, score, settings: { ...DEFAULT_SETTINGS, highlights, tileNames }, onPlayAgain: () => {}, onLeave: () => {} })));

describe('the match screen (PRD U1, U2, §5.8)', () => {
  const state = afterTakes(4, 4);
  const html = renderMatch(state);

  it('renders the seats, the board, the scoreboard row round the Match card and a top bar holding only the menu button, and no panel', () => {
    for (const testId of ['top-bar', 'scoreboard', 'score-A', 'score-B', 'score-draws', 'match-card', 'match-card-terrain', 'match-card-symbol', 'menu-button', 'seat-A', 'seat-B', 'avatar-A', 'avatar-B', 'board-frame', 'board', 'toasts', 'announcer']) {
      expect(html, testId).toContain(`data-testid="${testId}"`);
    }
    for (const testId of ['log', 'resolution', 'status', 'legend', 'settings', 'menu-settings', 'menu', 'end-screen', 'turn', 'last-tile', 'token-counts', 'sitting-score']) {
      expect(html, testId).not.toContain(`data-testid="${testId}"`);
    }
    const bar = /<header class="top-bar"[\s\S]*?<\/header>/.exec(html)![0];
    expect(bar.match(/<button/g)).toHaveLength(1);
    expect(bar).toContain('data-testid="menu-button"');
    expect(bar).not.toContain('data-testid="match-card"');
    // The score of the sitting shows once, in the scoreboard row: Player 1's score, the Match card, Player 2's
    // score, in that order, the draws line kept but hidden at zero; the seats have no Wins of their own.
    expect(html.match(/data-testid="scoreboard"/g)).toHaveLength(1);
    const row = /<section class="scoreboard"[\s\S]*?<\/section>/.exec(html)![0];
    expect(row).toContain('aria-label="You 0, Bot 0"');
    expect(row.indexOf('data-testid="score-A"')).toBeLessThan(row.indexOf('data-testid="match-card"'));
    expect(row.indexOf('data-testid="match-card"')).toBeLessThan(row.indexOf('data-testid="score-draws"'));
    expect(row.indexOf('data-testid="score-draws"')).toBeLessThan(row.indexOf('data-testid="score-B"'));
    expect(row).toContain('class="score-draws empty"');
    expect(row).toMatch(/data-testid="score-A"[\s\S]*?data-shape="ring"/);
    expect(row).toMatch(/data-testid="score-B"[\s\S]*?data-shape="diamond"/);
    expect(html).not.toMatch(/>Wins</);
    expect(html).not.toContain('seat-A-score');
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
    expect(html.match(/data-faded="true"/g)).toHaveLength(16 - 4 - legalTakes(state).length);
    // Each free tile carries its name on a plate the stylesheet shows on demand, read out by the cell's name only.
    expect(html.match(/class="tile-name" aria-hidden="true"/g)).toHaveLength(12);
    expect(html).toContain('data-names="false"');
    expect(renderMatch(state, { tileNames: true })).toContain('data-names="true"');
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
    expect(html).toContain('data-glow-player="A"');
    // No whose-turn stripe on the board: the frame carries no side.
    expect(html).not.toContain('data-active');
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
    expect(two).toContain('aria-label="Player 1 2, Player 2 1, 1 draw"');
    expect(two).toMatch(/class="score-draws" data-testid="score-draws" aria-hidden="true">1 draw</);
    // The glowing tiles carry the mover's badge with its token mark, and the pop's order and turn.
    expect(two).toContain('data-pop-turn="odd"');
    expect(two.match(/data-testid="move-badge"/g)).toHaveLength(legalTakes(afterTakes(4, 3)).length);
    expect(two).toMatch(/data-testid="move-badge" data-mark="diamond"/);
    expect(two).toContain('data-pop-order="0"');
    expect(two).toMatch(/data-testid="seat-A"[^>]*data-score="2"/);
    expect(two).toMatch(/aria-label="[A-D]\d, Player [12]'s token/);
    expect(two).not.toMatch(/your token|bot's token/);
  });

  it('makes nothing glow with highlights off', () => {
    expect(renderMatch(state, { highlights: false })).not.toContain('data-glow="true"');
    expect(renderMatch(state, { highlights: false })).not.toContain('data-faded="true"');
    expect(renderMatch(state, { highlights: false })).not.toContain('data-glow-player');
    expect(renderMatch(state, { highlights: false })).not.toMatch(/move-badge|data-pop-order|data-pop-turn/);
  });

  it.each(Object.entries(endings()))('shows the end screen once after a %s, with the stroke across a winning shape and the faces of the result', (by, finished) => {
    for (const mode of [normal, TWO_PLAYERS]) {
      const ended = renderMatch(finished, { mode });
      expect(ended.match(/data-testid="end-screen"/g)).toHaveLength(1);
      expect(ended).toContain(`data-by="${by}"`);
      expect(ended).toMatch(mode === normal ? /data-testid="result">(You win|The bot wins|Draw)/ : /data-testid="result">(Player [12] wins|Draw)/);
      expect(ended).toContain('Play again');
      expect(ended).toContain('>Home</button>');
      // The result card's buttons come first, so they sit in the same places in every ending.
      expect(ended).toMatch(/data-testid="end-screen"[^>]*><div class="button-row end-buttons"><button[^>]*data-testid="play-again"/);
      // The board plays the end sequence from the end model's marks.
      expect(ended).toContain(`data-end-kind="${by === 'full-board' ? 'draw' : by === 'blockade' ? 'blockade' : 'shape'}"`);
      expect(ended).toContain('data-end-skipped="false"');
      if (by === 'line' || by === 'square') {
        expect(ended.match(/data-end="lift"/g)).toHaveLength(4);
        expect(ended.match(/data-end="dim"/g)).toHaveLength(12);
        for (const order of [0, 1, 2, 3]) expect(ended).toContain(`data-lift-order="${order}"`);
      }
      if (by === 'blockade') expect(ended).toMatch(/data-testid="match-card-blocked"><span class="long-form">No tile matches \w+–\w+<\/span><span class="short-form">No match<\/span>/);
      expect(ended).not.toContain('data-faded="true"');
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

/** Every id attribute that appears more than once in the markup. */
function duplicateIds(html: string): string[] {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

describe('no duplicate id attributes (PRD U1: CSS-only materials need no ids)', () => {
  const noop = () => {};
  const memory = (): KeyValueStorage => {
    const data = new Map<string, string>();
    return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
  };

  it('renders the home screen, with and without a saved game, without duplicate ids', () => {
    const storage = memory();
    const fresh = renderToStaticMarkup(createElement(App, { storage }));
    expect(fresh).toContain('data-testid="home-screen"');
    expect(duplicateIds(fresh)).toEqual([]);
    saveGame(storage, afterTakes(4, 3), normal, NO_SCORE);
    const withSave = renderToStaticMarkup(createElement(App, { storage }));
    expect(withSave).toContain('data-testid="continue"');
    expect(withSave.match(/ id="[^"]*replaces"/g)).toHaveLength(1);
    expect(duplicateIds(withSave)).toEqual([]);
    const home = renderToStaticMarkup(
      createElement(HomeScreen, {
        model: homeModel({ mode: TWO_PLAYERS, takes: 2 }, DEFAULT_SETTINGS, emptyResults()),
        settings: DEFAULT_SETTINGS,
        onContinue: noop,
        onPlay: noop,
        onOpponent: noop,
        onDifficulty: noop,
        onClock: noop,
        onHowTo: noop,
        onResetResults: noop,
        onSettings: noop,
      }),
    );
    expect(duplicateIds(home)).toEqual([]);
  });

  it('renders a match in both modes and every end screen without duplicate ids', () => {
    for (const mode of [normal, TWO_PLAYERS]) {
      expect(duplicateIds(renderMatch(afterTakes(4, 4), { mode }))).toEqual([]);
      for (const finished of Object.values(endings())) {
        const html = renderMatch(finished, { mode });
        expect(html).toContain('data-testid="end-screen"');
        expect(duplicateIds(html)).toEqual([]);
      }
    }
  });

  it('draws no SVG defs, patterns or url(#…) fills anywhere', () => {
    for (const html of [renderMatch(afterTakes(4, 4)), renderToStaticMarkup(createElement(App, { storage: memory() }))]) {
      expect(html).not.toMatch(/<defs|<pattern|<linearGradient|<radialGradient|url\(#/);
    }
  });
});

describe('the avatars’ reactions on the match screen (PRD U9)', () => {
  it('starts a new or resumed game with no reaction on either seat', () => {
    for (const state of [newGame({ seed: 4, starter: 'A' }), afterTakes(4, 5)]) {
      const html = renderMatch(state);
      expect(html).not.toContain('data-reaction="');
      expect(html.match(/data-reaction-key="0"/g)!.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('shows the bot thinking on its turn', () => {
    expect(renderMatch(newGame({ seed: 4, starter: 'B' }))).toMatch(/data-testid="seat-B"[^>]*data-expression="thinking"/);
  });
});
