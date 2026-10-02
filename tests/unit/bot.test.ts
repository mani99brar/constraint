import { describe, expect, it } from 'vitest';
import { chooseAction, chooseSetup } from '@okiya/bot';
import { TILES, SPEC_V0_2 } from '@okiya/content';
import { applyAction, listLegalActions, playerView, prepareMatch, startMatch, validateSetup, type MatchState } from '@okiya/rules';

function botMatch(seed: number): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
  const input = { board: prepared.board, preset: SPEC_V0_2, privateSeed: seed };
  return startMatch(prepared, { A: chooseSetup({ ...input, privateSeed: seed + 1 }), B: chooseSetup(input) });
}

describe('bot setup choice', () => {
  it('returns a setup the validator accepts', () => {
    for (const seed of [0, 1, 17, 123456]) {
      const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
      const setup = chooseSetup({ board: prepared.board, preset: SPEC_V0_2, privateSeed: seed });
      expect(validateSetup(setup, SPEC_V0_2)).toEqual([]);
    }
  });

  it("respects the preset's displacer limit", () => {
    const preset = { ...SPEC_V0_2, variants: { ...SPEC_V0_2.variants, displacerLimit: 0 } };
    const prepared = prepareMatch({ tiles: TILES, preset, seed: 3 });
    expect(validateSetup(chooseSetup({ board: prepared.board, preset, privateSeed: 3 }), preset)).toEqual([]);
  });
});

describe('bot action choice', () => {
  it('only ever returns an action from the legal-action list', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let state = botMatch(seed);
      for (let turn = 0; turn < 40 && !state.result; turn += 1) {
        const legal = listLegalActions(state);
        const action = chooseAction(playerView(state, state.activePlayer), legal);
        expect(legal).toContainEqual(action);
        const applied = applyAction(state, action);
        if (!applied.ok) throw new Error(`bot action refused: ${JSON.stringify(applied.refusal)}`);
        state = applied.state;
      }
    }
  });

  it('gives the same action for the same view and seed', () => {
    const state = botMatch(77);
    const view = playerView(state, state.activePlayer);
    const legal = listLegalActions(state);
    expect(chooseAction(view, legal)).toEqual(chooseAction(structuredClone(view), [...legal]));
    const choices = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(chooseAction({ ...view, seed }, legal))));
    expect(choices.size).toBeGreaterThan(1);
  });
});
