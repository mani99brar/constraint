import type { MatchResult, PlayerId } from '@okiya/rules';
import { BOT_DEPTHS, type BotDepthId } from './difficulty';
import { isRecord, readJson, writeJson, type KeyValueStorage } from './storage';

/** Wins, losses and draws against one difficulty (PRD E7). */
export interface Tally {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export type Results = Readonly<Record<BotDepthId, Tally>>;
export type Outcome = 'win' | 'loss' | 'draw';

export const RESULTS_KEY = 'okiya.results';
const ZERO: Tally = { wins: 0, losses: 0, draws: 0 };

export function emptyResults(): Results {
  return Object.fromEntries(BOT_DEPTHS.map((depth) => [depth.id, ZERO])) as Results;
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0);

/** The stored results; anything missing or corrupt counts as zero. */
export function loadResults(storage: KeyValueStorage | null): Results {
  const stored = readJson(storage, RESULTS_KEY);
  const results = emptyResults() as Record<BotDepthId, Tally>;
  if (!isRecord(stored)) return results;
  for (const { id } of BOT_DEPTHS) {
    const entry = stored[id];
    if (isRecord(entry)) results[id] = { wins: count(entry.wins), losses: count(entry.losses), draws: count(entry.draws) };
  }
  return results;
}

/** The human's outcome of a finished match. */
export function outcomeOf(result: MatchResult, human: PlayerId): Outcome {
  if (result.kind === 'draw') return 'draw';
  return result.winner === human ? 'win' : 'loss';
}

/** Adds one finished match to the results of its difficulty, and returns the new results. */
export function recordResult(storage: KeyValueStorage | null, depth: BotDepthId, outcome: Outcome): Results {
  const results = loadResults(storage);
  const entry = results[depth];
  const next: Results = {
    ...results,
    [depth]: {
      wins: entry.wins + (outcome === 'win' ? 1 : 0),
      losses: entry.losses + (outcome === 'loss' ? 1 : 0),
      draws: entry.draws + (outcome === 'draw' ? 1 : 0),
    },
  };
  writeJson(storage, RESULTS_KEY, next);
  return next;
}

/** Sets every difficulty back to zero. */
export function resetResults(storage: KeyValueStorage | null): Results {
  const results = emptyResults();
  writeJson(storage, RESULTS_KEY, results);
  return results;
}
