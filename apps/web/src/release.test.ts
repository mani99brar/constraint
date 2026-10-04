/// <reference types="node" />
// Node reads the client's sources and index.html; the DOM is not needed.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import viteConfig from '../vite.config';
import { App } from './App';
import { DifficultyScreen } from './DifficultyScreen';
import { HowToPlay } from './HowToPlay';
import { MatchScreen } from './MatchScreen';
import { MenuDialog } from './MenuDialog';
import { TWO_PLAYERS, versusBot } from './mode';
import { ModeScreen } from './ModeScreen';
import { afterTakes, endings } from './playouts.test-helper';
import { emptyResults } from './results';
import { NO_SCORE } from './score';
import { DEFAULT_SETTINGS } from './settings';
import type { KeyValueStorage } from './storage';
import { TITLE, TITLE_PLACEHOLDER, withTitle } from './title';
import { TitleScreen } from './TitleScreen';

const noop = () => {};
const running = afterTakes(31_337, 3);

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
};

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

/** Every screen and dialog of the client, rendered. */
const screens: Record<string, string> = {
  app: render(createElement(App, { storage: memory() })),
  title: render(
    createElement(TitleScreen, {
      saved: { mode: versusBot('hard'), takes: 7 },
      results: emptyResults(),
      settings: DEFAULT_SETTINGS,
      onContinue: noop,
      onNewGame: noop,
      onHowTo: noop,
      onResetResults: noop,
      onSettings: noop,
    }),
  ),
  mode: render(createElement(ModeScreen, { onVersusBot: noop, onTwoPlayers: noop, onBack: noop })),
  difficulty: render(createElement(DifficultyScreen, { onChoose: noop, onBack: noop })),
  match: render(createElement(MatchScreen, { initialState: running, mode: versusBot('normal'), score: NO_SCORE, settings: DEFAULT_SETTINGS, onLeave: noop })),
  'two-player match': render(createElement(MatchScreen, { initialState: running, mode: TWO_PLAYERS, score: NO_SCORE, settings: DEFAULT_SETTINGS, onLeave: noop })),
  ...Object.fromEntries(
    Object.entries(endings()).map(([by, state]) => [
      `end by ${by}`,
      render(createElement(MatchScreen, { initialState: state, mode: versusBot('easy'), score: NO_SCORE, settings: DEFAULT_SETTINGS, onPlayAgain: noop, onLeave: noop })),
    ]),
  ),
  menu: render(
    createElement(MenuDialog, { title: 'Menu', settings: DEFAULT_SETTINGS, onSettings: noop, onClose: noop, returnFocusTo: null, onHowTo: noop, onQuit: noop }),
  ),
  howTo: render(createElement(HowToPlay, { onClose: noop, returnFocusTo: null })),
};

const files = readdirSync(import.meta.dirname).map((file) => [file, readFileSync(join(import.meta.dirname, file), 'utf8')] as const);
const sources = files.filter(([file]) => /\.tsx?$/.test(file) && !file.includes('.test'));
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** Words of the retired fighter game (spec v0.2). */
const FIGHTER_WORDS = /\b(fighters?|traps?|trapped|trapper|recharges?|recharged|rosters?|objectives?|abilit(y|ies)|setup screen|displacers?)\b/i;

describe('the fighter game is gone (rules v1.0)', () => {
  it('imports neither @okiya/rules nor @okiya/content anywhere under apps/web/src', () => {
    expect(files.length).toBeGreaterThan(20);
    for (const [file, text] of files) expect(text, file).not.toMatch(/['"]@okiya\/(rules|content)(\/[^'"]*)?['"]/);
  });

  it.each(Object.keys(screens))('renders no fighter, trap, recharge, roster or objective text on the %s screen', (name) => {
    const html = screens[name]!;
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toMatch(FIGHTER_WORDS);
    expect(html).not.toMatch(/data-testid="(own-tray|bot-tray|setup-board|pool|roster|goal-chip|recharges|constraint|token-actions)"/);
  });

  it('keeps no fighter, trap, recharge, roster or objective word in the client’s strings, styles or page', () => {
    for (const [file, text] of sources) expect(stripComments(text), file).not.toMatch(FIGHTER_WORDS);
    const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/\b(trap|fighter|recharge|roster|tray|pip|token-action|face-down|charge)/i);
    expect(readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')).not.toMatch(FIGHTER_WORDS);
  });

  it('detects the words it looks for', () => {
    for (const word of ['Fighter', 'traps', 'Recharge', 'roster', 'Objective', 'ability']) expect(word).toMatch(FIGHTER_WORDS);
    for (const word of ['wrapFocus', 'Strategy', 'abilityless']) expect(word).not.toMatch(FIGHTER_WORDS);
  });
});

describe('no playtest helpers (PRD S1, E6)', () => {
  it.each(Object.keys(screens))('the %s screen renders no seed', (name) => {
    const html = screens[name]!;
    expect(html).not.toMatch(/seed/i);
    expect(html).not.toContain(String(running.seed));
  });

  it('reads no URL parameters anywhere in the client', () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const [file, text] of sources) expect(text, file).not.toMatch(/URLSearchParams|location\.(search|hash|href)|window\.location/);
  });
});

describe('the published title (PRD §1, E6)', () => {
  it('lives in one constant used by the page title and the title screen', () => {
    expect(TITLE).toBe('Constraint');
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain(`<title>${TITLE_PLACEHOLDER}</title>`);
    expect(withTitle(html)).toContain(`<title>${TITLE}</title>`);
    expect(withTitle(html)).not.toContain(TITLE_PLACEHOLDER);
    expect(html).not.toMatch(/okiya/i);
    expect(screens.app).toContain(`<h1 data-testid="title">${TITLE}</h1>`);
    for (const html of Object.values(screens)) expect(html).not.toMatch(/okiya/i);
  });

  it('builds with relative asset paths', () => {
    expect((viteConfig as { base?: string }).base).toBe('./');
  });
});
