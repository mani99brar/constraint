import { HUMAN } from './match';
import type { GameState } from '@okiya/game';
import { takeShortText, takeText } from './announce';
import type { GameMode } from './mode';
import type { SoundEffect } from './sound';
import { takeToast, type ToastSpec } from './toasts';

/** What the newest take is heard and shown as: one sound, the bot's take toast, and whether the turn changed. */
export interface TakeFeedback {
  readonly sound: SoundEffect | null;
  readonly toasts: readonly ToastSpec[];
  /** A take was made, so the turn has moved on and a refusal from before it is out of date. */
  readonly turnChanged: boolean;
}

const QUIET: TakeFeedback = { sound: null, toasts: [], turnChanged: false };

/**
 * The feedback of the takes made since `heardTakes`; a resumed game starts quiet, so a state with no
 * new take gives none. The result's sound replaces the take's, and no toast names the result: the end
 * screen and the seats show it once (PRD U3). Only the bot's takes get a toast, the one that ends the
 * game included.
 */
export function takeFeedback(state: GameState, heardTakes: number, mode: GameMode): TakeFeedback {
  if (state.takes.length <= heardTakes) return QUIET;
  // The engine passes the turn on every take, the last one included, so the player to move did not
  // make the newest take. Player 2's takes, the bot's included, sound lower.
  const byPlayerTwo = state.toMove === 'A';
  const toasts = mode.kind === 'bot' && byPlayerTwo ? [takeToast(takeText(state, mode)!, takeShortText(state, mode)!)] : [];
  const { result } = state;
  if (result) {
    const sound: SoundEffect = result.kind === 'draw' ? 'draw' : mode.kind === 'bot' && result.winner !== HUMAN ? 'loss' : 'win';
    return { sound, toasts, turnChanged: true };
  }
  return { sound: byPlayerTwo ? 'bot' : 'place', toasts, turnChanged: true };
}
