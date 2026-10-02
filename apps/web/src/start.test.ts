import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_MAX_DEPTH } from '@okiya/bot';
import { PAPER_TEST_01, PRESETS, SCENARIOS, SPEC_V0_2, SPEC_V0_2_TWO_DISPLACERS } from '@okiya/content';
import { HUMAN } from './match';
import {
  BOT_DEPTHS,
  DEFAULT_DEPTH,
  differenceLines,
  initialChoice,
  presetDifferences,
  scenarioSetup,
  searchOptionsFor,
  startFromChoice,
  type StartChoice,
} from './start';
import { StartScreen } from './StartScreen';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const DEFAULTS: StartChoice = { presetId: 'spec-v0.2', scenarioId: '', seedText: '', depth: DEFAULT_DEPTH };
const html = decode(renderToStaticMarkup(createElement(StartScreen, { initial: DEFAULTS, onStart: () => {} })));

describe('match-start screen (PRD S1, S4, P2)', () => {
  it('lists every preset in PRESETS with how it differs from spec-v0.2', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const preset of PRESETS) {
      expect(html).toContain(`value="${preset.id}"`);
      expect(html).toContain(preset.name);
      for (const line of differenceLines(preset)) expect(html).toContain(line);
    }
  });

  it('names the displacer limit as the difference of spec-v0.2-two-displacers', () => {
    expect(presetDifferences(SPEC_V0_2_TWO_DISPLACERS)).toEqual([{ label: 'Displacers per roster', value: 'at most 2', base: 'no limit' }]);
    expect(differenceLines(SPEC_V0_2_TWO_DISPLACERS)).toEqual(['Displacers per roster: at most 2 (spec-v0.2: no limit).']);
    expect(presetDifferences(SPEC_V0_2)).toEqual([]);
    const repetition = { ...SPEC_V0_2, id: 'test-repetition-2', repetitionThreshold: 2 };
    expect(differenceLines(repetition)).toEqual([
      'Repetition draw: occurrence 2 of the same start-of-turn state (spec-v0.2: occurrence 3 of the same start-of-turn state).',
    ]);
  });

  it('lists every scenario in SCENARIOS, and none as the default', () => {
    expect(html).toContain('<option value="" selected="">None');
    for (const scenario of SCENARIOS) {
      expect(html).toContain(`value="${scenario.id}"`);
      expect(html).toContain(scenario.name);
    }
  });

  it('takes an optional seed: generated when empty, kept when typed, refused when malformed', () => {
    const generated = startFromChoice(DEFAULTS, () => 99);
    expect(generated.ok && generated.prepared.seed).toBe(99);
    const typed = startFromChoice({ ...DEFAULTS, seedText: '4242' }, () => 99);
    expect(typed.ok && typed.prepared.seed).toBe(4242);
    expect(startFromChoice({ ...DEFAULTS, seedText: 'x' }).ok).toBe(false);
    expect(html).toContain('name="seed"');
  });

  it('prepares the chosen preset and the scenario board, and skips setup when the scenario fixes it', () => {
    const result = startFromChoice({ ...DEFAULTS, presetId: SPEC_V0_2_TWO_DISPLACERS.id, scenarioId: PAPER_TEST_01.id, seedText: '1' });
    if (!result.ok) throw new Error(result.error);
    expect(result.prepared.preset).toBe(SPEC_V0_2_TWO_DISPLACERS);
    expect(result.prepared.board).toEqual(PAPER_TEST_01.board);
    expect(scenarioSetup(result.prepared.scenario, HUMAN)).toEqual({ roster: PAPER_TEST_01.rosters!.A, traps: PAPER_TEST_01.traps!.A });
    expect(scenarioSetup(null, HUMAN)).toBeNull();
    expect(startFromChoice({ ...DEFAULTS, presetId: 'nope' }).ok).toBe(false);
  });

  it('maps the bot depth choice Easy 1, Normal 2, Hard 3 to SearchOptions', () => {
    expect(BOT_DEPTHS.map((depth) => [depth.label, depth.maxDepth])).toEqual([
      ['Easy', 1],
      ['Normal', 2],
      ['Hard', 3],
    ]);
    expect(searchOptionsFor('easy')).toEqual({ maxDepth: 1 });
    expect(searchOptionsFor('normal')).toEqual({ maxDepth: 2 });
    expect(searchOptionsFor('hard')).toEqual({ maxDepth: 3 });
    expect(searchOptionsFor(DEFAULT_DEPTH).maxDepth).toBe(DEFAULT_MAX_DEPTH);
    for (const depth of BOT_DEPTHS) expect(html).toContain(`value="${depth.id}"`);
  });

  it('reads the first choices from the page address', () => {
    expect(initialChoice('?seed=7&preset=spec-v0.2-two-displacers&scenario=paper-test-01&depth=hard')).toEqual({
      presetId: 'spec-v0.2-two-displacers',
      scenarioId: 'paper-test-01',
      seedText: '7',
      depth: 'hard',
    });
    expect(initialChoice('?preset=unknown&depth=extreme')).toEqual(DEFAULTS);
  });
});
