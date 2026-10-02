import { useEffect, useMemo, useState } from 'react';
import { chooseAction } from '@okiya/bot';
import { applyAction, listLegalActions, playerView, type Action, type ActionRefusal, type MatchState } from '@okiya/rules';
import { BOT, BOT_DELAY_MS, HUMAN } from './match';

/**
 * Holds the referee state and exposes only the human's player view, the human's legal actions and
 * a way to attempt an action. The bot moves from its own view after a short pause.
 */
export function useMatch(initialState: MatchState) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (state.result || state.activePlayer !== BOT) return;
    const scheduledTurn = state.turn;
    const timer = setTimeout(() => {
      setState((current) => {
        // StrictMode mounts effects twice; only the move for the scheduled turn applies.
        const view = playerView(current, BOT);
        if (view.turn !== scheduledTurn || view.activePlayer !== BOT || view.result) return current;
        const applied = applyAction(current, chooseAction(view, listLegalActions(current)));
        return applied.ok ? applied.state : current;
      });
    }, BOT_DELAY_MS);
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
