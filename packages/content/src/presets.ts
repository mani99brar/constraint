import type { Preset } from '@okiya/rules';

/** The spec's current provisional defaults (PRD §6); every variant switch at its default. */
export const SPEC_V0_2: Preset = {
  id: 'spec-v0.2',
  version: '0.2.0',
  name: 'Spec v0.2 defaults',
  rosterSize: 4,
  rechargesPerPlayer: 3,
  setupTrapsPerPlayer: 2,
  setupTrapsOnDistinctCells: true,
  liveTrapsPerOwnerPerCell: 1,
  openingRule: 'outside-edge-no-constraint',
  trapsTriggerOnOpening: true,
  lockOwnTurnsMissed: 1,
  trapCheckerRule: 'single-adjacent-cell',
  trapCheckerLegalWithNothingFound: true,
  trapperDestinationMustMatch: false,
  trapperKeepsConstraint: true,
  sameTypesAcrossRosters: true,
  repetitionThreshold: 3,
  terminalPrecedence: ['objective', 'blockade', 'repetition'],
  objectivePool: ['Square'],
  variants: {
    anchorProtection: 'through-opponent-next-turn',
    pullerMayTargetAllies: true,
    lockedFightersCountTowardObjective: true,
    displacerLimit: null,
  },
};

/**
 * Spec v0.2 with at most two displacers (Pusher, Puller, Swapper) per roster: paper test 01
 * found displacer count decided the game (B1), so this preset tests balanced rosters.
 */
export const SPEC_V0_2_TWO_DISPLACERS: Preset = {
  ...SPEC_V0_2,
  id: 'spec-v0.2-two-displacers',
  name: 'Spec v0.2, at most two displacers',
  variants: { ...SPEC_V0_2.variants, displacerLimit: 2 },
};

/**
 * Spec v0.2 where a locked fighter does not count toward the objective (paper test 01,
 * recommended change 4: let a trap on a square cell matter). Objectives are checked only after a
 * fully resolved action (spec §10, §11 step 7), so a lock expiring never wins on its own: the
 * square counts at the next check, after either player's action.
 */
export const SPEC_V0_2_LOCKED_DONT_COUNT: Preset = {
  ...SPEC_V0_2,
  id: 'spec-v0.2-locked-dont-count',
  name: "Spec v0.2, locked fighters don't count",
  variants: { ...SPEC_V0_2.variants, lockedFightersCountTowardObjective: false },
};

/** Spec v0.2 with a draw on the second occurrence of the same start-of-turn state (spec §12). */
export const SPEC_V0_2_REPETITION_2: Preset = {
  ...SPEC_V0_2,
  id: 'spec-v0.2-repetition-2',
  name: 'Spec v0.2, draw on the first repetition',
  repetitionThreshold: 2,
};

export const PRESETS: readonly Preset[] = [SPEC_V0_2, SPEC_V0_2_TWO_DISPLACERS, SPEC_V0_2_LOCKED_DONT_COUNT, SPEC_V0_2_REPETITION_2];
