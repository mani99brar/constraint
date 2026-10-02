import { ALL_CELLS } from '../api/board';
import type { ObjectiveId } from '../api/fighters';
import type { TerminalCheck } from '../api/preset';

/** A preset value the engine cannot play under: its path, for example `variants.displacerLimit`. */
export interface PresetIssue {
  readonly field: string;
  readonly value: unknown;
}

/** The objectives the engine implements (spec §10). */
export const OBJECTIVE_IDS: readonly ObjectiveId[] = ['Square'];

/** Objective, then blockade, then repetition: the order of the checks in spec §11. */
export const SPEC_TERMINAL_PRECEDENCE: readonly TerminalCheck[] = ['objective', 'blockade', 'repetition'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInteger = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const isText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
const isBoolean = (value: unknown): boolean => typeof value === 'boolean';

/**
 * Every value of an untrusted preset the engine cannot play under (PRD P1), in field order; an
 * empty list means the engine can replay a match under it. `parseMatchLog` refuses a log on the
 * first issue; `validatePreset` in `packages/content` judges presets through `parseMatchLog`, so
 * content and the log reader apply this one rule set.
 */
export function presetIssues(preset: unknown): PresetIssue[] {
  if (!isRecord(preset)) return [{ field: '', value: preset }];
  const issues: PresetIssue[] = [];
  const check = (field: string, value: unknown, ok: boolean) => {
    if (!ok) issues.push({ field, value });
  };
  check('id', preset.id, isText(preset.id));
  check('version', preset.version, isText(preset.version));
  check('name', preset.name, typeof preset.name === 'string');
  check('rosterSize', preset.rosterSize, preset.rosterSize === 4);
  check('rechargesPerPlayer', preset.rechargesPerPlayer, isInteger(preset.rechargesPerPlayer, 0));
  check('setupTrapsPerPlayer', preset.setupTrapsPerPlayer, isInteger(preset.setupTrapsPerPlayer, 0, ALL_CELLS.length));
  check('setupTrapsOnDistinctCells', preset.setupTrapsOnDistinctCells, isBoolean(preset.setupTrapsOnDistinctCells));
  check('liveTrapsPerOwnerPerCell', preset.liveTrapsPerOwnerPerCell, isInteger(preset.liveTrapsPerOwnerPerCell, 1));
  check('openingRule', preset.openingRule, preset.openingRule === 'outside-edge-no-constraint');
  check('trapsTriggerOnOpening', preset.trapsTriggerOnOpening, isBoolean(preset.trapsTriggerOnOpening));
  check('lockOwnTurnsMissed', preset.lockOwnTurnsMissed, isInteger(preset.lockOwnTurnsMissed, 1));
  check('trapCheckerRule', preset.trapCheckerRule, preset.trapCheckerRule === 'single-adjacent-cell');
  // Not switches: false would let the legal-action list reveal hidden traps (spec §9), and the
  // step order of spec §11 fixes the precedence, so the engine reads neither value.
  check('trapCheckerLegalWithNothingFound', preset.trapCheckerLegalWithNothingFound, preset.trapCheckerLegalWithNothingFound === true);
  check('trapperDestinationMustMatch', preset.trapperDestinationMustMatch, isBoolean(preset.trapperDestinationMustMatch));
  check('trapperKeepsConstraint', preset.trapperKeepsConstraint, isBoolean(preset.trapperKeepsConstraint));
  check('sameTypesAcrossRosters', preset.sameTypesAcrossRosters, isBoolean(preset.sameTypesAcrossRosters));
  check('repetitionThreshold', preset.repetitionThreshold, isInteger(preset.repetitionThreshold, 2));
  const precedence = preset.terminalPrecedence;
  check(
    'terminalPrecedence',
    precedence,
    Array.isArray(precedence) &&
      precedence.length === SPEC_TERMINAL_PRECEDENCE.length &&
      precedence.every((value, index) => value === SPEC_TERMINAL_PRECEDENCE[index]),
  );
  const pool = preset.objectivePool;
  check(
    'objectivePool',
    pool,
    Array.isArray(pool) && pool.length > 0 && pool.every((id) => (OBJECTIVE_IDS as readonly unknown[]).includes(id)),
  );
  const { variants } = preset;
  if (!isRecord(variants)) {
    check('variants', variants, false);
    return issues;
  }
  check(
    'variants.anchorProtection',
    variants.anchorProtection,
    variants.anchorProtection === 'through-opponent-next-turn' || variants.anchorProtection === 'through-owner-following-turn',
  );
  check('variants.pullerMayTargetAllies', variants.pullerMayTargetAllies, isBoolean(variants.pullerMayTargetAllies));
  check(
    'variants.lockedFightersCountTowardObjective',
    variants.lockedFightersCountTowardObjective,
    isBoolean(variants.lockedFightersCountTowardObjective),
  );
  const rosterSize = isInteger(preset.rosterSize, 0) ? (preset.rosterSize as number) : 0;
  check(
    'variants.displacerLimit',
    variants.displacerLimit,
    variants.displacerLimit === null || isInteger(variants.displacerLimit, 0, rosterSize),
  );
  return issues;
}

