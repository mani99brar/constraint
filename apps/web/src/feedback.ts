import type { GameState, Player } from '@okiya/game';
import { outcomeOf } from './results';
import type { SoundEffect } from './sound';
import { resultSummary } from './text';
import { endToast, type ToastSpec } from './toasts';

/** What the newest take is heard and shown as: one sound, and a toast when it ended the game. */
export interface TakeFeedback {
  readonly sound: SoundEffect | null;
  readonly toasts: readonly ToastSpec[];
}

/**
 * The feedback of the takes made since `heardTakes`; a resumed game starts quiet, so a state with no
 * new take gives none. The result's sound replaces the take's, and its toast names the result.
 */
export function takeFeedback(state: GameState, heardTakes: number, human: Player): TakeFeedback {
  if (state.takes.length <= heardTakes) return { sound: null, toasts: [] };
  if (state.result) {
    const outcome = outcomeOf(state.result, human);
    return { sound: outcome, toasts: [endToast(resultSummary(state.result, human), outcome)] };
  }
  // The player to move did not make the newest take.
  return { sound: state.toMove === human ? 'bot' : 'place', toasts: [] };
}
