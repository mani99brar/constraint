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

export const PRESETS: readonly Preset[] = [SPEC_V0_2];
