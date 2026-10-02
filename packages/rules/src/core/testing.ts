// Fixtures for the rules engine's own unit tests. `packages/rules` never imports
// `packages/content`, so the tests carry their own tiles and preset.

import { ALL_CELLS, SYMBOLS, TERRAINS, type Board, type CellId, type Constraint, type Tile } from '../api/board';
import type { FighterId, FighterType, PlayerId } from '../api/fighters';
import type { Preset } from '../api/preset';
import type { Setup } from '../api/setup';
import type { FighterState, MatchState, TrapRecord } from '../api/state';
import type { Action } from '../api/actions';
import type { ResolutionEvent } from '../api/events';
import { applyAction } from './apply';
import { prepareMatch, startMatch } from './setup';

export const TEST_TILES: readonly Tile[] = TERRAINS.flatMap((terrain) => SYMBOLS.map((symbol) => ({ terrain, symbol })));

/** Rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols (Sun, Moon, Star, Wave). */
export const GRID_BOARD: Board = Object.fromEntries(ALL_CELLS.map((cell, index) => [cell, TEST_TILES[index]!])) as Board;

export const TEST_PRESET: Preset = {
  id: 'test',
  version: '0.0.0',
  name: 'Test preset',
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

export const TEST_SETUPS: Readonly<Record<PlayerId, Setup>> = {
  A: { roster: ['Teleporter', 'Pusher', 'TrapChecker', 'TerrainWeaver'], traps: ['B2', 'C3'] },
  B: { roster: ['Swapper', 'Upgrader', 'Puller', 'Trapper'], traps: ['A3', 'D2'] },
};

/** A match started from a seed with the shuffled test tiles. */
export function seededMatch(seed: number): MatchState {
  return startMatch(prepareMatch({ tiles: TEST_TILES, preset: TEST_PRESET, seed }), TEST_SETUPS);
}

/**
 * A match on `GRID_BOARD` with A to move, for constructed positions. Rosters default to
 * `TEST_SETUPS`; the preset defaults to `TEST_PRESET`.
 */
export function gridMatch(
  rosters: Partial<Record<PlayerId, readonly FighterType[]>> = {},
  preset: Preset = TEST_PRESET,
): MatchState {
  const prepared = prepareMatch({
    tiles: TEST_TILES,
    preset,
    seed: 1,
    scenario: { id: 'grid', name: 'Grid', board: GRID_BOARD, startingPlayer: 'A' },
  });
  return startMatch(prepared, {
    A: { ...TEST_SETUPS.A, roster: rosters.A ?? TEST_SETUPS.A.roster },
    B: { ...TEST_SETUPS.B, roster: rosters.B ?? TEST_SETUPS.B.roster },
  });
}

/** `TEST_PRESET` with some variant switches flipped (PRD §6). */
export function presetWith(variants: Partial<Preset['variants']>, values: Partial<Preset> = {}): Preset {
  return { ...TEST_PRESET, ...values, variants: { ...TEST_PRESET.variants, ...variants } };
}

/** Replaces every trap with the given live setup traps, written `owner@cell`. */
export function withTraps(state: MatchState, traps: readonly string[]): MatchState {
  const trapHistory: TrapRecord[] = traps.map((text, index) => {
    const [owner, cell] = text.split('@') as [PlayerId, CellId];
    return { id: `${owner}-setup-${index + 1}`, owner, cell, source: 'setup', placedOnTurn: 0, placedBy: null, fate: { kind: 'live' } };
  });
  return { ...state, traps: trapHistory.map(({ id, owner, cell }) => ({ id, owner, cell })), trapHistory };
}

export const liveTraps = (state: MatchState): string[] => state.traps.map((trap) => `${trap.owner}@${trap.cell}`);

export function fighterOf(state: MatchState, id: FighterId): FighterState {
  const found = state.fighters.find((fighter) => fighter.id === id);
  if (!found) throw new Error(`No fighter ${id}`);
  return found;
}

/** The next state of a legal action; throws with the refusal otherwise. */
export function applied(state: MatchState, action: Action): { state: MatchState; events: readonly ResolutionEvent[] } {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.refusal)}`);
  return result;
}

/** Applies legal actions in order. */
export function play(state: MatchState, ...actions: Action[]): MatchState {
  for (const action of actions) state = applied(state, action).state;
  return state;
}

export const tile = (terrain: Tile['terrain'], symbol: Tile['symbol']): Constraint => ({ terrain, symbol });

/** Places fighters and overrides state fields to construct a position. */
export function construct(
  state: MatchState,
  positions: Partial<Record<FighterId, CellId | null>>,
  patch: Partial<MatchState> = {},
  fighterPatch: Partial<Record<FighterId, Partial<FighterState>>> = {},
): MatchState {
  const fighters = state.fighters.map((fighter) => ({
    ...fighter,
    ...(fighter.id in positions ? { cell: positions[fighter.id] ?? null } : {}),
    ...fighterPatch[fighter.id],
  }));
  return { ...state, fighters, ...patch };
}

export const A = (type: FighterType): FighterId => `A:${type}`;
export const B = (type: FighterType): FighterId => `B:${type}`;
