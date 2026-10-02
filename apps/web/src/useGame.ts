import { useEffect, useRef, useState } from 'react';
import { take, type CellId, type GameState, type TakeRefusal } from '@okiya/game';
import type { Difficulty } from './difficulty';
import { botToMove, humanToMove, scheduleBotTake } from './match';

/**
 * Holds the game state, lets the human attempt a take and lets the bot take after a short pause.
 * `onChange` hears every new state once, to save the game or record its result.
 */
export function useGame(initialState: GameState, difficulty: Difficulty, onChange?: (state: GameState) => void) {
  const [state, setState] = useState(initialState);
  const listener = useRef(onChange);
  listener.current = onChange;
  const reported = useRef<GameState | null>(null);

  useEffect(() => {
    // StrictMode runs effects twice; each state is reported once.
    if (reported.current === state) return;
    reported.current = state;
    listener.current?.(state);
  }, [state]);

  useEffect(() => {
    if (!botToMove(state)) return;
    // StrictMode mounts effects twice: the first schedule is cancelled, and `botStep` only takes for the
    // scheduled turn. The bot chooses once, outside the state updater, which StrictMode may call twice.
    return scheduleBotTake(state, difficulty, (next) => setState((current) => (current === state ? next : current)));
  }, [state, difficulty]);

  /** Takes the tile at `cell` for the human, or returns the refusal without changing anything. */
  function attempt(cell: CellId): TakeRefusal | null {
    if (!humanToMove(state)) return null;
    const taken = take(state, cell);
    if (!taken.ok) return taken.refusal;
    setState(taken.state);
    return null;
  }

  return { state, attempt };
}
