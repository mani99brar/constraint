import { defaultSetup } from '@okiya/content';
import {
  ALL_CELLS,
  validateSetup,
  type CellId,
  type FighterType,
  type Preset,
  type Setup,
  type SetupRefusal,
} from '@okiya/rules';
import { HUMAN } from './match';

/** The roster and trap cells the player has chosen so far on the setup screen. */
export interface SetupDraft {
  readonly roster: readonly FighterType[];
  readonly traps: readonly CellId[];
}

export const EMPTY_DRAFT: SetupDraft = { roster: [], traps: [] };

export type DraftChange = { readonly draft: SetupDraft; readonly refusal: SetupRefusal | null };

const ROSTER_CODES: readonly SetupRefusal['code'][] = ['roster-size', 'unknown-fighter', 'fighters-not-distinct', 'displacer-limit'];
const TRAP_CODES: readonly SetupRefusal['code'][] = ['trap-count', 'unknown-cell', 'trap-cells-not-distinct'];

/**
 * The first refusal `validateSetup` gives the draft for the given codes, ignoring counts that are
 * still too low: a roster or trap list in progress is short, never long.
 */
function firstRefusal(draft: SetupDraft, preset: Preset, codes: readonly SetupRefusal['code'][]): SetupRefusal | null {
  return (
    validateSetup(draft, preset).find(
      (refusal) =>
        codes.includes(refusal.code) &&
        !((refusal.code === 'roster-size' || refusal.code === 'trap-count') && refusal.actual < refusal.expected),
    ) ?? null
  );
}

/** Adds a fighter to the roster, unless `validateSetup` refuses the result (spec §5 step 3). */
export function addFighter(draft: SetupDraft, type: FighterType, preset: Preset): DraftChange {
  const next = { ...draft, roster: [...draft.roster, type] };
  const refusal = firstRefusal(next, preset, ROSTER_CODES);
  return refusal ? { draft, refusal } : { draft: next, refusal: null };
}

export function removeFighter(draft: SetupDraft, type: FighterType): SetupDraft {
  return { ...draft, roster: draft.roster.filter((fighter) => fighter !== type) };
}

/** Places a setup trap on a cell, or lifts the one already there (spec §5 step 5). */
export function toggleTrap(draft: SetupDraft, cell: CellId, preset: Preset): DraftChange {
  if (draft.traps.includes(cell)) return { draft: { ...draft, traps: draft.traps.filter((trap) => trap !== cell) }, refusal: null };
  const next = { ...draft, traps: [...draft.traps, cell] };
  const refusal = firstRefusal(next, preset, TRAP_CODES);
  return refusal ? { draft, refusal } : { draft: next, refusal: null };
}

/** Every refusal of the finished setup; the match starts only when there is none. */
export function setupRefusals(draft: SetupDraft, preset: Preset): SetupRefusal[] {
  return validateSetup(draft, preset);
}

/** A small seeded generator (mulberry32), so the default traps follow the match seed. */
function seededGenerator(seed: number): () => number {
  let state = (seed ^ 0x5eed_7a95) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/**
 * "Use default setup": the paper test 01 roster of side A, and the preset's setup traps on
 * distinct cells chosen from the match seed, so the same seed always gives the same traps.
 */
export function defaultHumanSetup(seed: number, preset: Preset): Setup {
  const next = seededGenerator(seed);
  const cells: CellId[] = [...ALL_CELLS];
  const traps: CellId[] = [];
  for (let i = 0; i < preset.setupTrapsPerPlayer && cells.length > 0; i += 1) {
    traps.push(cells.splice(Math.floor(next() * cells.length), 1)[0]!);
  }
  return { roster: defaultSetup(HUMAN).roster, traps };
}
