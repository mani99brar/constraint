import { describe, expect, it } from 'vitest';
import { SPEC_V0_2 } from '@okiya/content';
import { isEdgeCell, playerView } from '@okiya/rules';
import { BOT, botStep, createMatch, generateSeed, HUMAN, PRESET, prepare } from './match';
import { defaultHumanSetup } from './setup';

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

describe('match randomness (PRD E1)', () => {
  it('draws match seeds from crypto.getRandomValues and always plays spec-v0.2', () => {
    const original = crypto.getRandomValues.bind(crypto);
    const calls: number[] = [];
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T) => {
        calls.push(1);
        (array as unknown as Uint32Array)[0] = 0xdead_beef;
        return array;
      },
    });
    try {
      expect(generateSeed()).toBe(0xdead_beef >>> 1);
      const prepared = prepare();
      expect(prepared.seed).toBe(0xdead_beef >>> 1);
      expect(prepared.preset).toBe(SPEC_V0_2);
      expect(PRESET).toBe(SPEC_V0_2);
      expect(prepared.scenario).toBeNull();
      expect(calls).toHaveLength(2);
    } finally {
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: original });
    }
  });
});
