import type { SearchOptions } from '@okiya/bot';
import { PRESETS, SCENARIOS, SPEC_V0_2 } from '@okiya/content';
import type { PlayerId, PreparedMatch, Preset, Scenario, Setup } from '@okiya/rules';
import { chooseSeed, generateSeed, prepare } from './match';
import { presetRows } from './text';

/** Bot strength as search depth (decisions: Easy 1, Normal 2, Hard 3), passed to `chooseAction`. */
export const BOT_DEPTHS = [
  { id: 'easy', label: 'Easy', maxDepth: 1, description: 'looks at its own actions only' },
  { id: 'normal', label: 'Normal', maxDepth: 2, description: 'also weighs your best reply' },
  { id: 'hard', label: 'Hard', maxDepth: 3, description: 'searches one more ply' },
] as const;

export type BotDepthId = (typeof BOT_DEPTHS)[number]['id'];
export const DEFAULT_DEPTH: BotDepthId = 'normal';

export function isBotDepth(value: string): value is BotDepthId {
  return BOT_DEPTHS.some((depth) => depth.id === value);
}

export function searchOptionsFor(depth: BotDepthId): SearchOptions {
  return { maxDepth: BOT_DEPTHS.find((candidate) => candidate.id === depth)!.maxDepth };
}

export function depthLabel(depth: BotDepthId): string {
  return BOT_DEPTHS.find((candidate) => candidate.id === depth)!.label;
}

/** The base every preset is compared with (PRD P2). */
export const BASE_PRESET: Preset = SPEC_V0_2;

export interface PresetDifference {
  readonly label: string;
  readonly value: string;
  readonly base: string;
}

/** The rules-panel rows where a preset differs from `spec-v0.2`, other than its name (PRD P2). */
export function presetDifferences(preset: Preset, base: Preset = BASE_PRESET): PresetDifference[] {
  const baseRows = new Map(presetRows(base).map((row) => [row.label, row.value]));
  return presetRows(preset)
    .filter((row) => row.label !== 'Preset' && baseRows.get(row.label) !== row.value)
    .map((row) => ({ label: row.label, value: row.value, base: baseRows.get(row.label) ?? '' }));
}

/** One sentence per difference, or a note that the preset holds the base defaults. */
export function differenceLines(preset: Preset, base: Preset = BASE_PRESET): string[] {
  if (preset.id === base.id) return [`The spec's current defaults.`];
  const differences = presetDifferences(preset, base);
  if (differences.length === 0) return [`Same values as ${base.id}.`];
  return differences.map((difference) => `${difference.label}: ${difference.value} (${base.id}: ${difference.base}).`);
}

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

/** What a scenario fixes, in words, for the start screen. */
export function scenarioDescription(scenario: Scenario): string {
  const parts: string[] = [];
  if (scenario.board) parts.push('fixed board');
  if (scenario.rosters?.A || scenario.rosters?.B) parts.push('fixed rosters');
  if (scenario.traps?.A || scenario.traps?.B) parts.push('fixed setup traps');
  if (scenario.startingPlayer) parts.push(`${scenario.startingPlayer} starts`);
  return parts.join(', ');
}

/** The human's setup when a scenario fixes both its roster and its traps; then setup is skipped. */
export function scenarioSetup(scenario: Scenario | null, player: PlayerId): Setup | null {
  const roster = scenario?.rosters?.[player];
  const traps = scenario?.traps?.[player];
  return roster && traps ? { roster, traps } : null;
}

/** The match-start form (PRD S1, S4): preset, scenario (empty for none), seed text and bot depth. */
export interface StartChoice {
  readonly presetId: string;
  readonly scenarioId: string;
  readonly seedText: string;
  readonly depth: BotDepthId;
}

/** The form's first values: the defaults, overridden by `?seed=`, `?preset=`, `?scenario=` and `?depth=`. */
export function initialChoice(search: string): StartChoice {
  const params = new URLSearchParams(search);
  const preset = params.get('preset');
  const scenario = params.get('scenario');
  const depth = params.get('depth');
  return {
    presetId: preset && findPreset(preset) ? preset : BASE_PRESET.id,
    scenarioId: scenario && findScenario(scenario) ? scenario : '',
    seedText: params.get('seed') ?? '',
    depth: depth && isBotDepth(depth) ? depth : DEFAULT_DEPTH,
  };
}

export type StartResult =
  | { readonly ok: true; readonly prepared: PreparedMatch; readonly depth: BotDepthId }
  | { readonly ok: false; readonly error: string };

/** Setup phase one from the form, or the reason the form is refused. */
export function startFromChoice(choice: StartChoice, generate: () => number = generateSeed): StartResult {
  const preset = findPreset(choice.presetId);
  if (!preset) return { ok: false, error: `Unknown preset ${choice.presetId}.` };
  const scenario = choice.scenarioId === '' ? undefined : findScenario(choice.scenarioId);
  if (choice.scenarioId !== '' && !scenario) return { ok: false, error: `Unknown scenario ${choice.scenarioId}.` };
  const seed = chooseSeed(choice.seedText, generate);
  if (!seed.ok) return seed;
  return { ok: true, prepared: prepare(seed.seed, preset, scenario), depth: choice.depth };
}
