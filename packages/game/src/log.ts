import { isCellId, type CellId } from './board';
import { isValidSeed, newGame, take } from './game';
import { PLAYERS, type GameState, type Player, type TakeRefusal } from './state';

export const GAME_LOG_FORMAT_VERSION = 1;

/** Everything that reproduces a game (spec §6): its seed, its starting player and its takes in order. */
export interface GameLog {
  readonly formatVersion: typeof GAME_LOG_FORMAT_VERSION;
  readonly seed: number;
  readonly starter: Player;
  readonly takes: readonly CellId[];
}

export type GameLogRefusal =
  | { readonly code: 'not-a-game-log'; readonly field: string }
  | { readonly code: 'unsupported-format-version'; readonly found: unknown }
  | { readonly code: 'take-refused'; readonly takeIndex: number; readonly refusal: TakeRefusal };

export function gameLogOf(state: GameState): GameLog {
  return { formatVersion: GAME_LOG_FORMAT_VERSION, seed: state.seed, starter: state.starter, takes: [...state.takes] };
}

/** Checks the shape of untrusted data, such as a saved game, without trusting any field. */
export function parseGameLog(input: unknown): { readonly ok: true; readonly log: GameLog } | { readonly ok: false; readonly refusal: GameLogRefusal } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, refusal: { code: 'not-a-game-log', field: '' } };
  const value = input as Record<string, unknown>;
  if (value.formatVersion !== GAME_LOG_FORMAT_VERSION) return { ok: false, refusal: { code: 'unsupported-format-version', found: value.formatVersion } };
  if (!isValidSeed(value.seed)) return { ok: false, refusal: { code: 'not-a-game-log', field: 'seed' } };
  if (!(PLAYERS as readonly unknown[]).includes(value.starter)) return { ok: false, refusal: { code: 'not-a-game-log', field: 'starter' } };
  if (!Array.isArray(value.takes)) return { ok: false, refusal: { code: 'not-a-game-log', field: 'takes' } };
  const bad = value.takes.findIndex((cell) => !isCellId(cell));
  if (bad !== -1) return { ok: false, refusal: { code: 'not-a-game-log', field: `takes.${bad}` } };
  return { ok: true, log: { formatVersion: GAME_LOG_FORMAT_VERSION, seed: value.seed, starter: value.starter as Player, takes: [...(value.takes as CellId[])] } };
}

/** The state after setup and after every take; refuses the first illegal take with its index. */
export function replayGame(log: GameLog): { readonly ok: true; readonly states: readonly GameState[] } | { readonly ok: false; readonly refusal: GameLogRefusal } {
  let state = newGame({ seed: log.seed, starter: log.starter });
  const states = [state];
  for (const [takeIndex, cell] of log.takes.entries()) {
    const result = take(state, cell);
    if (!result.ok) return { ok: false, refusal: { code: 'take-refused', takeIndex, refusal: result.refusal } };
    state = result.state;
    states.push(state);
  }
  return { ok: true, states };
}
