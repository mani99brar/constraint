// Test helper, not shipped: real games of the engine that end in each way, found by deterministic playouts.
import { ALL_CELLS, legalTakes, newGame, take, type GameResult, type GameState, type Player } from '@okiya/game';

/** Plays a game from `seed` with a fixed pick among the legal takes at every turn, until it ends. */
export function playout(seed: number, pick: (legal: number, turn: number) => number): GameState {
  let state = newGame({ seed });
  while (!state.result) {
    const legal = legalTakes(state);
    const taken = take(state, legal[pick(legal.length, state.takes.length) % legal.length]!);
    if (!taken.ok) throw new Error('a legal take was refused');
    state = taken.state;
  }
  return state;
}

export type Ending = 'line' | 'square' | 'blockade' | 'full-board';

/** A finished real game for every ending, the first one found over seeds and two pick policies. */
export function endings(): Record<Ending, GameState> {
  const found: Partial<Record<Ending, GameState>> = {};
  for (let seed = 0; seed < 2000 && Object.keys(found).length < 4; seed += 1) {
    for (const pick of [(n: number, turn: number) => (seed + turn * 7) % n, (n: number) => n - 1]) {
      const state = playout(seed, pick);
      const by = state.result!.by;
      found[by] ??= state;
    }
  }
  if (Object.keys(found).length < 4) throw new Error(`playouts found only ${Object.keys(found).join(', ')}`);
  return found as Record<Ending, GameState>;
}

/** A state after `count` takes of a real game, each the first legal take. */
export function afterTakes(seed: number, count: number, starter: 'A' | 'B' = 'A'): GameState {
  let state = newGame({ seed, starter });
  for (let i = 0; i < count && !state.result; i += 1) {
    const taken = take(state, legalTakes(state)[0]!);
    if (!taken.ok) throw new Error('a legal take was refused');
    state = taken.state;
  }
  return state;
}

/**
 * A hand-built state on the board of `newGame({ seed: 11 })`: the given tokens on the first cells in
 * board order, the last tile, the player to move and the starter. Takes list the token cells.
 */
export function handBuilt(
  tokens: readonly (Player | null)[],
  toMove: Player,
  lastTile: GameState['lastTile'],
  { starter = 'A', result = null }: { starter?: Player; result?: GameResult | null } = {},
): GameState {
  const base = newGame({ seed: 11, starter });
  const padded = [...tokens, ...Array<Player | null>(16 - tokens.length).fill(null)];
  return { ...base, tokens: padded, toMove, starter, lastTile, takes: ALL_CELLS.filter((_, i) => padded[i] !== null), result };
}
