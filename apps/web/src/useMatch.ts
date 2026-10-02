import { useEffect, useMemo, useState } from 'react';
import { applyAction, listLegalActions, playerView, type Action, type ActionRefusal, type MatchState } from '@okiya/rules';
import { BOT_DELAY_MS, botStep, botToMove, HUMAN } from './match';

/**
 * Holds the referee state and exposes only the human's player view, the human's legal actions and
 * a way to attempt an action. The bot moves from its own view after a short pause.
 */
export function useMatch(initialState: MatchState) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!botToMove(state)) return;
    const scheduledTurn = state.turn;
    // StrictMode mounts effects twice; `botStep` only applies the move for the scheduled turn.
    const timer = setTimeout(() => setState((current) => botStep(current, scheduledTurn)), BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const view = useMemo(() => playerView(state, HUMAN), [state]);
  const legalActions = useMemo(() => (state.activePlayer === HUMAN ? listLegalActions(state) : []), [state]);

  /** Applies the human's action, or returns its refusal without changing anything. */
  function attempt(action: Action): ActionRefusal | null {
    const applied = applyAction(state, action);
    if (!applied.ok) return applied.refusal;
    setState(applied.state);
    return null;
  }

  return { view, legalActions, attempt };
}
