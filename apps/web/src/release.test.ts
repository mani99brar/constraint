/// <reference types="node" />
// Node reads the client's sources and index.html; the DOM is not needed.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRESETS, SCENARIOS, SPEC_V0_2 } from '@okiya/content';
import { playerView } from '@okiya/rules';
import viteConfig from '../vite.config';
import { App } from './App';
import { DifficultyScreen } from './DifficultyScreen';
import { EndScreen } from './EndScreen';
import { createMatch, HUMAN, prepare } from './match';
import { MatchScreen } from './MatchScreen';
import { emptyResults } from './results';
import { DEFAULT_SETTINGS } from './settings';
import { defaultHumanSetup } from './setup';
import { SetupScreen } from './SetupScreen';
import type { KeyValueStorage } from './storage';
import { TITLE, TITLE_PLACEHOLDER, withTitle } from './title';
import { TitleScreen } from './TitleScreen';

const SEED = 31_337;
const noop = () => {};
const state = createMatch(prepare(SEED), defaultHumanSetup(SEED, SPEC_V0_2), 4_242);
const finishedView = { ...playerView(state, HUMAN), result: { kind: 'draw', reason: 'repetition' } as const, reveal: {
  objectives: { A: 'Square', B: 'Square' } as const,
  rosters: { A: state.setups.A.roster, B: state.setups.B.roster },
  trapHistory: [],
} };

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
};

const screens: Record<string, string> = {
  app: renderToStaticMarkup(createElement(App, { storage: memory() })),
  title: renderToStaticMarkup(
    createElement(TitleScreen, {
      saved: { depth: 'hard', turn: 7 },
      results: emptyResults(),
      settings: DEFAULT_SETTINGS,
      onContinue: noop,
      onNewGame: noop,
      onHowTo: noop,
      onResetResults: noop,
      onSettings: noop,
    }),
  ),
  difficulty: renderToStaticMarkup(createElement(DifficultyScreen, { onChoose: noop, onBack: noop })),
  setup: renderToStaticMarkup(createElement(SetupScreen, { prepared: prepare(SEED), depth: 'normal', onStart: noop, onLeave: noop, onHowTo: noop })),
  match: renderToStaticMarkup(
    createElement(MatchScreen, { initialState: state, depth: 'normal', settings: DEFAULT_SETTINGS, onSettings: noop, onHowTo: noop, onLeave: noop }),
  ),
  end: renderToStaticMarkup(createElement(EndScreen, { view: finishedView, human: HUMAN })),
};

describe('playtest helpers removed (PRD E1)', () => {
  it.each(Object.keys(screens))('the %s screen renders no seed, preset, scenario or preset-values panel', (name) => {
    const html = screens[name]!;
    expect(html).not.toMatch(/seed/i);
    expect(html).not.toContain(String(SEED));
    expect(html).not.toContain(String(state.seed));
    expect(html).not.toMatch(/preset/i);
    expect(html).not.toMatch(/scenario/i);
    expect(html).not.toContain('data-testid="rules"');
    expect(html).not.toContain('data-rule=');
    for (const preset of PRESETS) expect(html).not.toContain(preset.id);
    for (const scenario of SCENARIOS) expect(html).not.toContain(scenario.name);
  });

  const sources = readdirSync(import.meta.dirname)
    .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
    .map((file) => [file, readFileSync(join(import.meta.dirname, file), 'utf8')] as const);

  it('reads no URL parameters anywhere in the client', () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const [file, text] of sources) {
      expect(text, file).not.toMatch(/URLSearchParams|location\.(search|hash|href)|window\.location/);
    }
  });

  it('imports no presets other than spec-v0.2 and no scenarios', () => {
    for (const [file, text] of sources) {
      expect(text, file).not.toMatch(/\b(PRESETS|SCENARIOS|PAPER_TEST_01\w*|SPEC_V0_2_\w+)\b/);
    }
  });
});

describe('the published title (PRD §5.8)', () => {
  it('lives in one constant used by the page title and the title screen', () => {
    expect(TITLE).toBe('Constraint');
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain(`<title>${TITLE_PLACEHOLDER}</title>`);
    expect(withTitle(html)).toContain(`<title>${TITLE}</title>`);
    expect(withTitle(html)).not.toContain(TITLE_PLACEHOLDER);
    expect(html).not.toMatch(/okiya/i);
    expect(screens.app).toContain(`<h1 data-testid="title">${TITLE}</h1>`);
  });

  it('builds with relative asset paths (PRD E8)', () => {
    expect((viteConfig as { base?: string }).base).toBe('./');
  });
});
