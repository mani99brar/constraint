import { useEffect, useRef, useState } from 'react';
import { take, type CellId, type GameState, type TakeRefusal } from '@okiya/game';
import { botToMove, scheduleBotTake } from './match';
import { personToMove, type GameMode } from './mode';

/**
 * Holds the game state and lets the person to move attempt a take; in a bot game the bot takes after
 * a short pause, and a two-player game has no bot and no pause. `onChange` hears every new state once,
 * to save the game or record its result.
 */
export function useGame(initialState: GameState, mode: GameMode, onChange?: (state: GameState) => void) {
  const [state, setState] = useState(initialState);
  const listener = useRef(onChange);
  listener.current = onChange;
  const reported = useRef<GameState | null>(null);
  const difficulty = mode.kind === 'bot' ? mode.difficulty : null;

  useEffect(() => {
    // StrictMode runs effects twice; each state is reported once.
    if (reported.current === state) return;
    reported.current = state;
    listener.current?.(state);
  }, [state]);

  useEffect(() => {
    if (difficulty === null || !botToMove(state)) return;
    // StrictMode mounts effects twice: the first schedule is cancelled, and `botStep` only takes for the
    // scheduled turn. The bot chooses once, outside the state updater, which StrictMode may call twice.
    return scheduleBotTake(state, difficulty, (next) => setState((current) => (current === state ? next : current)));
  }, [state, difficulty]);

  /** Takes the tile at `cell` for the person to move, or returns the refusal without changing anything. */
  function attempt(cell: CellId): TakeRefusal | null {
    if (!personToMove(state, mode)) return null;
    const taken = take(state, cell);
    if (!taken.ok) return taken.refusal;
    setState(taken.state);
    return null;
  }

  return { state, attempt };
}
