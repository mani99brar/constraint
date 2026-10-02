import { legalTakes, take, type CellId, type GameState } from '@okiya/game';

// The bot of Constraint v1.0 (docs/game-spec.md). This is the thin first version the `pure-okiya` bot lane
// replaces with a real search behind the same signature.

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface TakeOptions {
  /** Defaults to 'normal'. */
  readonly difficulty?: Difficulty;
}

/**
 * The bot's take for the player to move: deterministic for a given state and options, and always one of
 * `legalTakes(state)`. Throws when the game has ended or no take is legal.
 */
export function chooseTake(state: GameState, _options: TakeOptions = {}): CellId {
  const options = legalTakes(state);
  if (options.length === 0) throw new Error('chooseTake: no legal take');
  const winning = options.find((cell) => {
    const next = take(state, cell);
    return next.ok && next.state.result?.kind === 'win' && next.state.result.winner === state.toMove;
  });
  return winning ?? options[0]!;
}
