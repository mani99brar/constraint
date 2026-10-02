import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS, SPEC_V0_2 } from '@okiya/content';
import { validateSetup, type FighterType, type Preset } from '@okiya/rules';
import { addFighter, defaultHumanSetup, EMPTY_DRAFT, setupRefusals, toggleTrap, type DraftChange, type SetupDraft } from './setup';
import { describeSetupRefusal } from './text';

const LIMIT_ONE: Preset = { ...SPEC_V0_2, id: 'test-displacer-limit-1', variants: { ...SPEC_V0_2.variants, displacerLimit: 1 } };

function pick(draft: SetupDraft, ...types: FighterType[]): DraftChange {
  let change: DraftChange = { draft, refusal: null };
  for (const type of types) change = addFighter(change.draft, type, SPEC_V0_2);
  return change;
}

describe('roster selection (spec §5 step 3)', () => {
  it('refuses a fifth fighter and a duplicate with their reasons', () => {
    const four = pick(EMPTY_DRAFT, 'Teleporter', 'Pusher', 'Anchor', 'Trapper');
    expect(four.refusal).toBeNull();
    expect(four.draft.roster).toHaveLength(4);

    const fifth = addFighter(four.draft, 'Swapper', SPEC_V0_2);
    expect(fifth.draft).toBe(four.draft);
    expect(fifth.refusal).toEqual({ code: 'roster-size', expected: 4, actual: 5 });

    const duplicate = addFighter({ ...four.draft, roster: ['Teleporter'] }, 'Teleporter', SPEC_V0_2);
    expect(duplicate.refusal).toEqual({ code: 'fighters-not-distinct', fighter: 'Teleporter' });
    expect(duplicate.draft.roster).toEqual(['Teleporter']);
  });

  it('shows the displacer-limit refusal from validateSetup when a second displacer is picked', () => {
    const first = addFighter(EMPTY_DRAFT, 'Pusher', LIMIT_ONE);
    expect(first.refusal).toBeNull();
    const second = addFighter(first.draft, 'Swapper', LIMIT_ONE);
    const expected = validateSetup({ roster: ['Pusher', 'Swapper'], traps: [] }, LIMIT_ONE).find((r) => r.code === 'displacer-limit');
    expect(expected).toEqual({ code: 'displacer-limit', limit: 1, actual: 2 });
    expect(second.refusal).toEqual(expected);
    expect(second.draft.roster).toEqual(['Pusher']);
    expect(describeSetupRefusal(second.refusal!)).toBe(
      'At most 1 displacers (Pusher, Puller, Swapper) are allowed; this roster has 2.',
    );
    // A non-displacer is still accepted.
    expect(addFighter(first.draft, 'Anchor', LIMIT_ONE).refusal).toBeNull();
  });
});

describe('setup traps (spec §5 step 5)', () => {
  it('places traps on distinct cells, lifts a trap on a second click and refuses one too many', () => {
    let draft = toggleTrap(EMPTY_DRAFT, 'B2', SPEC_V0_2).draft;
    expect(toggleTrap(draft, 'B2', SPEC_V0_2).draft.traps).toEqual([]);
    draft = toggleTrap(draft, 'C3', SPEC_V0_2).draft;
    expect(draft.traps).toEqual(['B2', 'C3']);
    const third = toggleTrap(draft, 'D4', SPEC_V0_2);
    expect(third.refusal).toEqual({ code: 'trap-count', expected: 2, actual: 3 });
    expect(third.draft).toBe(draft);
  });

  it('refuses to start with an incomplete setup', () => {
    expect(setupRefusals(EMPTY_DRAFT, SPEC_V0_2).map((refusal) => refusal.code)).toEqual(['roster-size', 'trap-count']);
  });
});

describe('Use default setup', () => {
  it('gives the paper test 01 roster of side A and traps on distinct cells that validateSetup accepts', () => {
    for (const seed of [0, 1, 2, 42, 123_456, 4_294_967_295]) {
      const setup = defaultHumanSetup(seed, SPEC_V0_2);
      expect(validateSetup(setup, SPEC_V0_2)).toEqual([]);
      expect(setup.roster).toEqual(DEFAULT_ROSTERS.A);
      expect(setup.traps).toHaveLength(SPEC_V0_2.setupTrapsPerPlayer);
      expect(new Set(setup.traps).size).toBe(setup.traps.length);
    }
  });

  it('gives the same traps for the same match seed', () => {
    expect(defaultHumanSetup(77, SPEC_V0_2)).toEqual(defaultHumanSetup(77, SPEC_V0_2));
    const distinct = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => defaultHumanSetup(seed, SPEC_V0_2).traps.join()));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
