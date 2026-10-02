import {
  ALL_CELLS,
  DISPLACER_TYPES,
  FIGHTER_TYPES,
  PLAYERS,
  SYMBOLS,
  TERRAINS,
  validateSetup,
  type FighterDefinition,
  type PlayerId,
  type Preset,
  type Scenario,
  type SetupRefusal,
  type Tile,
} from '@okiya/rules';
import { DEFAULT_ROSTERS } from './defaults';
import { OBJECTIVES } from './fighters';

/** A structured content problem; an empty list means the data is valid. */
export type ContentIssue =
  | { readonly code: 'tile-count'; readonly expected: number; readonly actual: number }
  | { readonly code: 'unknown-terrain'; readonly value: string }
  | { readonly code: 'unknown-symbol'; readonly value: string }
  | { readonly code: 'duplicate-tile'; readonly tile: Tile }
  | { readonly code: 'unknown-fighter'; readonly value: string }
  | { readonly code: 'duplicate-fighter'; readonly value: string }
  | { readonly code: 'missing-fighter'; readonly value: string }
  | { readonly code: 'displacer-flag'; readonly value: string; readonly expected: boolean }
  | { readonly code: 'missing-text'; readonly value: string; readonly field: string }
  | { readonly code: 'invalid-preset-value'; readonly field: string; readonly value: unknown }
  | { readonly code: 'board-cell-missing'; readonly cell: string }
  | { readonly code: 'scenario-setup'; readonly player: PlayerId; readonly refusal: SetupRefusal };

/** The tiles must be all 16 terrain/symbol pairs exactly once (spec §3). */
export function validateTiles(tiles: readonly Tile[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const expected = TERRAINS.length * SYMBOLS.length;
  if (tiles.length !== expected) issues.push({ code: 'tile-count', expected, actual: tiles.length });
  const seen = new Set<string>();
  for (const tile of tiles) {
    if (!(TERRAINS as readonly string[]).includes(tile.terrain)) issues.push({ code: 'unknown-terrain', value: tile.terrain });
    if (!(SYMBOLS as readonly string[]).includes(tile.symbol)) issues.push({ code: 'unknown-symbol', value: tile.symbol });
    const key = `${tile.terrain}-${tile.symbol}`;
    if (seen.has(key)) issues.push({ code: 'duplicate-tile', tile });
    seen.add(key);
  }
  return issues;
}

/** One definition per fighter type of the pool, with the right displacer flag (spec §9, PRD §6). */
export function validateFighters(definitions: readonly FighterDefinition[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (!(FIGHTER_TYPES as readonly string[]).includes(definition.type)) {
      issues.push({ code: 'unknown-fighter', value: definition.type });
      continue;
    }
    if (seen.has(definition.type)) issues.push({ code: 'duplicate-fighter', value: definition.type });
    seen.add(definition.type);
    const expected = DISPLACER_TYPES.includes(definition.type);
    if (definition.displacer !== expected) issues.push({ code: 'displacer-flag', value: definition.type, expected });
    for (const field of ['name', 'abbreviation', 'summary'] as const) {
      if (definition[field].trim() === '') issues.push({ code: 'missing-text', value: definition.type, field });
    }
  }
  for (const type of FIGHTER_TYPES) if (!seen.has(type)) issues.push({ code: 'missing-fighter', value: type });
  return issues;
}

const isInteger = (value: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Rejects impossible presets (PRD P1). */
export function validatePreset(preset: Preset): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const check = (field: string, value: unknown, ok: boolean) => {
    if (!ok) issues.push({ code: 'invalid-preset-value', field, value });
  };
  check('id', preset.id, preset.id.trim() !== '');
  check('version', preset.version, preset.version.trim() !== '');
  check('rosterSize', preset.rosterSize, preset.rosterSize === 4);
  check('rechargesPerPlayer', preset.rechargesPerPlayer, isInteger(preset.rechargesPerPlayer, 0));
  check('setupTrapsPerPlayer', preset.setupTrapsPerPlayer, isInteger(preset.setupTrapsPerPlayer, 0, ALL_CELLS.length));
  check('liveTrapsPerOwnerPerCell', preset.liveTrapsPerOwnerPerCell, isInteger(preset.liveTrapsPerOwnerPerCell, 1));
  check('openingRule', preset.openingRule, preset.openingRule === 'outside-edge-no-constraint');
  check('lockOwnTurnsMissed', preset.lockOwnTurnsMissed, isInteger(preset.lockOwnTurnsMissed, 1));
  check('trapCheckerRule', preset.trapCheckerRule, preset.trapCheckerRule === 'single-adjacent-cell');
  check('repetitionThreshold', preset.repetitionThreshold, isInteger(preset.repetitionThreshold, 2));
  check(
    'terminalPrecedence',
    preset.terminalPrecedence,
    preset.terminalPrecedence.length === 3 && new Set(preset.terminalPrecedence).size === 3,
  );
  check(
    'objectivePool',
    preset.objectivePool,
    preset.objectivePool.length > 0 && preset.objectivePool.every((id) => OBJECTIVES.some((objective) => objective.id === id)),
  );
  const { variants } = preset;
  check(
    'variants.anchorProtection',
    variants.anchorProtection,
    variants.anchorProtection === 'through-opponent-next-turn' || variants.anchorProtection === 'through-owner-following-turn',
  );
  check(
    'variants.displacerLimit',
    variants.displacerLimit,
    variants.displacerLimit === null || isInteger(variants.displacerLimit, 0, preset.rosterSize),
  );
  return issues;
}

/** A scenario's board must hold the 16 tiles once each; its rosters and traps must form valid setups. */
export function validateScenario(scenario: Scenario, preset: Preset): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (scenario.board) {
    const board = scenario.board;
    for (const cell of ALL_CELLS) if (!board[cell]) issues.push({ code: 'board-cell-missing', cell });
    issues.push(...validateTiles(ALL_CELLS.filter((cell) => board[cell]).map((cell) => board[cell])));
  }
  for (const player of PLAYERS) {
    const roster = scenario.rosters?.[player];
    const traps = scenario.traps?.[player];
    if (!roster && !traps) continue;
    // Fill the part the scenario leaves to the player with a valid default, so refusals point at the scenario.
    const refusals = validateSetup(
      { roster: roster ?? DEFAULT_ROSTERS[player], traps: traps ?? ALL_CELLS.slice(0, preset.setupTrapsPerPlayer) },
      preset,
    );
    for (const refusal of refusals) issues.push({ code: 'scenario-setup', player, refusal });
  }
  return issues;
}
