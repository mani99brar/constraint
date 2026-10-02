import { ALL_CELLS, isCellId, type Board, type Tile } from '../api/board';
import { DISPLACER_TYPES, fighterId, isFighterType, PLAYERS, type FighterType, type PlayerId } from '../api/fighters';
import type { Preset } from '../api/preset';
import type { PreparedMatch, Scenario, Setup, SetupRefusal } from '../api/setup';
import type { FighterState, LiveTrap, MatchState, TrapRecord } from '../api/state';
import { createRng, drawInt, shuffle } from './random';
import { canonicalSignature } from './signature';

export interface PrepareMatchInput {
  /** The 16 terrain/symbol tiles to shuffle, normally from `packages/content`. */
  readonly tiles: readonly Tile[];
  readonly preset: Preset;
  /** A 32-bit integer seed; it decides the board shuffle and the starting player (spec §5). */
  readonly seed: number;
  readonly scenario?: Scenario;
}

/** Setup phase one (spec §5 step 1): shuffle the tiles with the seed and reveal the board. */
export function prepareMatch(input: PrepareMatchInput): PreparedMatch {
  let rng = createRng(input.seed);
  let board: Board;
  if (input.scenario?.board) {
    board = input.scenario.board;
  } else {
    if (input.tiles.length !== ALL_CELLS.length) {
      throw new Error(`Expected ${ALL_CELLS.length} tiles, got ${input.tiles.length}`);
    }
    const [shuffled, next] = shuffle(input.tiles, rng);
    rng = next;
    board = Object.fromEntries(ALL_CELLS.map((cell, index) => [cell, shuffled[index]!])) as Board;
  }
  return { preset: input.preset, seed: input.seed, board, rng, scenario: input.scenario ?? null };
}

/** Structured refusals for one side's setup; an empty list means the setup is valid. */
export function validateSetup(setup: Setup, preset: Preset): SetupRefusal[] {
  const refusals: SetupRefusal[] = [];
  if (setup.roster.length !== preset.rosterSize) {
    refusals.push({ code: 'roster-size', expected: preset.rosterSize, actual: setup.roster.length });
  }
  const seenFighters = new Set<string>();
  for (const fighter of setup.roster) {
    if (!isFighterType(fighter)) {
      refusals.push({ code: 'unknown-fighter', fighter });
    } else if (seenFighters.has(fighter)) {
      refusals.push({ code: 'fighters-not-distinct', fighter });
    }
    seenFighters.add(fighter);
  }
  const limit = preset.variants.displacerLimit;
  const displacers = setup.roster.filter((fighter) => DISPLACER_TYPES.includes(fighter)).length;
  if (limit !== null && displacers > limit) {
    refusals.push({ code: 'displacer-limit', limit, actual: displacers });
  }
  if (setup.traps.length !== preset.setupTrapsPerPlayer) {
    refusals.push({ code: 'trap-count', expected: preset.setupTrapsPerPlayer, actual: setup.traps.length });
  }
  const seenCells = new Set<string>();
  for (const cell of setup.traps) {
    if (!isCellId(cell)) {
      refusals.push({ code: 'unknown-cell', cell });
    } else if (seenCells.has(cell) && preset.setupTrapsOnDistinctCells) {
      refusals.push({ code: 'trap-cells-not-distinct', cell });
    }
    seenCells.add(cell);
  }
  return refusals;
}

export class InvalidSetupError extends Error {
  constructor(readonly refusals: Readonly<Record<PlayerId, readonly SetupRefusal[]>>) {
    super(`Invalid setup: ${JSON.stringify(refusals)}`);
  }
}

/**
 * Setup phase two (spec §5 steps 2–6): apply both sides' secret setups and pick the starting
 * player with the seeded generator. A scenario here, or else the one given to `prepareMatch`,
 * overrides rosters, traps or the starting player (PRD S4). Throws `InvalidSetupError` when a
 * resulting setup fails `validateSetup`.
 */
export function startMatch(
  prepared: PreparedMatch,
  setups: Readonly<Record<PlayerId, Setup>>,
  scenario?: Scenario,
): MatchState {
  const effectiveScenario = scenario ?? prepared.scenario;
  const { preset } = prepared;
  const finalSetups = {} as Record<PlayerId, Setup>;
  for (const player of PLAYERS) {
    finalSetups[player] = {
      roster: effectiveScenario?.rosters?.[player] ?? setups[player].roster,
      traps: effectiveScenario?.traps?.[player] ?? setups[player].traps,
    };
  }
  const refusals = { A: validateSetup(finalSetups.A, preset), B: validateSetup(finalSetups.B, preset) };
  if (refusals.A.length > 0 || refusals.B.length > 0) throw new InvalidSetupError(refusals);

  let rng = prepared.rng;
  let startingPlayer: PlayerId;
  if (effectiveScenario?.startingPlayer) {
    startingPlayer = effectiveScenario.startingPlayer;
  } else {
    const [index, next] = drawInt(rng, 0, 1);
    rng = next;
    startingPlayer = PLAYERS[index]!;
  }

  const fighters: FighterState[] = PLAYERS.flatMap((owner) =>
    finalSetups[owner].roster.map((type: FighterType) => ({
      id: fighterId(owner, type),
      owner,
      type,
      cell: null,
      charge: 1 as const,
      lock: null,
      protection: null,
    })),
  );
  const traps: LiveTrap[] = PLAYERS.flatMap((owner) =>
    finalSetups[owner].traps.map((cell, index) => ({ id: `${owner}-setup-${index + 1}`, owner, cell })),
  );
  const trapHistory: TrapRecord[] = traps.map((trap) => ({
    ...trap,
    source: 'setup',
    placedOnTurn: 0,
    placedBy: null,
    fate: { kind: 'live' },
  }));
  const objective = preset.objectivePool[0] ?? 'Square';

  const state: MatchState = {
    preset,
    seed: prepared.seed,
    scenario: effectiveScenario,
    board: prepared.board,
    rng,
    objectives: { A: objective, B: objective },
    setups: finalSetups,
    startingPlayer,
    fighters,
    constraint: null,
    activePlayer: startingPlayer,
    turn: 1,
    recharges: { A: preset.rechargesPerPlayer, B: preset.rechargesPerPlayer },
    traps,
    trapHistory,
    inspections: [],
    history: [],
    repetition: [],
    result: null,
  };
  return { ...state, repetition: [canonicalSignature(state)] };
}
