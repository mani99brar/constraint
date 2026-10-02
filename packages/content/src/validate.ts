import {
  ALL_CELLS,
  DISPLACER_TYPES,
  FIGHTER_TYPES,
  MATCH_LOG_FORMAT_VERSION,
  parseMatchLog,
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
import { SPEC_V0_2 } from './presets';

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

/** A log that carries only a preset, so `parseMatchLog` judges the preset values alone. */
function presetOnlyLog(values: unknown): unknown {
  const empty = { roster: [], traps: [] };
  const preset = { id: SPEC_V0_2.id, version: SPEC_V0_2.version, values };
  return { formatVersion: MATCH_LOG_FORMAT_VERSION, preset, seed: 0, scenario: null, setups: { A: empty, B: empty }, actions: [] };
}

/** Whether the engine refuses a preset value at `field`, a path such as `variants.displacerLimit`. */
function engineRefuses(values: unknown, field: string): boolean {
  const parsed = parseMatchLog(presetOnlyLog(values));
  return !parsed.ok && parsed.refusal.code === 'not-a-match-log' && parsed.refusal.field === `preset.values.${field}`;
}

/**
 * Rejects impossible presets (PRD P1) with the engine's own rules, those `parseMatchLog` applies
 * to a loaded or restored match, so content never accepts a preset a match log cannot replay.
 * Each value is judged alone inside `spec-v0.2`, so every bad field is reported, in field order.
 */
export function validatePreset(preset: Preset): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const given = preset as unknown as Record<string, unknown>;
  for (const field of Object.keys(SPEC_V0_2) as (keyof Preset)[]) {
    const value = given[field];
    if (field !== 'variants') {
      if (engineRefuses({ ...SPEC_V0_2, [field]: value }, field)) issues.push({ code: 'invalid-preset-value', field, value });
      continue;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issues.push({ code: 'invalid-preset-value', field, value });
      continue;
    }
    const variants = value as Record<string, unknown>;
    for (const key of Object.keys(SPEC_V0_2.variants)) {
      const path = `variants.${key}`;
      const values = { ...SPEC_V0_2, variants: { ...SPEC_V0_2.variants, [key]: variants[key] } };
      if (engineRefuses(values, path)) issues.push({ code: 'invalid-preset-value', field: path, value: variants[key] });
    }
  }
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
