import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { isEdgeCell, playerView } from '@okiya/rules';
import { BOT, botStep, chooseSeed, createMatch, HUMAN, prepare, seedTextFromSearch } from './match';
import { defaultHumanSetup } from './setup';
import { SetupScreen } from './SetupScreen';

function seedOf(text: string): number {
  const choice = chooseSeed(text);
  if (!choice.ok) throw new Error(choice.error);
  return choice.seed;
}

const noop = () => {};

describe('match seed (PRD S1, L1)', () => {
  it('generates a seed when none is given, and the setup screen shows it', () => {
    const seed = seedOf('');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(chooseSeed('', () => 31_337)).toEqual({ ok: true, seed: 31_337 });
    const html = renderToStaticMarkup(createElement(SetupScreen, { prepared: prepare(31_337), onStart: noop, onLeave: noop }));
    expect(html).toContain('Seed 31337');
  });

  it('gives the same board for a seed typed in the field and the same seed in ?seed=', () => {
    expect(seedTextFromSearch('?seed=4242')).toBe('4242');
    expect(seedTextFromSearch('')).toBe('');
    const typed = prepare(seedOf('4242'));
    const fromUrl = prepare(seedOf(seedTextFromSearch('?seed=4242')));
    expect(fromUrl.board).toEqual(typed.board);
    expect(prepare(seedOf('4243')).board).not.toEqual(typed.board);
  });

  it('refuses a malformed seed', () => {
    expect(chooseSeed('abc').ok).toBe(false);
    expect(chooseSeed('4294967296').ok).toBe(false);
  });
});

describe('bot opening', () => {
  it('makes the opening deployment before the player’s first turn when the bot starts', () => {
    const seed = [...Array(64).keys()].find((candidate) => {
      const prepared = prepare(candidate);
      return createMatch(prepared, defaultHumanSetup(candidate, SPEC_V0_2), 7).startingPlayer === BOT;
    });
    expect(seed).toBeDefined();
    const state = createMatch(prepare(seed!), defaultHumanSetup(seed!, SPEC_V0_2), 7);
    expect(state.activePlayer).toBe(BOT);
    expect(playerView(state, HUMAN).log).toEqual([]);

    // A move scheduled for another turn is ignored, as StrictMode's second effect is.
    expect(botStep(state, state.turn + 1)).toBe(state);

    const next = botStep(state, state.turn);
    expect(next.activePlayer).toBe(HUMAN);
    const log = playerView(next, HUMAN).log;
    expect(log).toHaveLength(1);
    expect(log[0]!.player).toBe(BOT);
    expect(log[0]!.action.kind).toBe('deploy');
    if (log[0]!.action.kind === 'deploy') expect(isEdgeCell(log[0]!.action.cell)).toBe(true);
    expect(next.constraint).not.toBeNull();
    // On the player's turn the bot does not move again.
    expect(botStep(next)).toBe(next);
  });
});
