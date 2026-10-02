import { chooseTake } from '@okiya/bot';
import { newGame, otherPlayer, take, type GameState, type Player } from '@okiya/game';
import type { Difficulty } from './difficulty';

/** The human always plays A; the bot plays B. Either may start (spec §5). */
export const HUMAN = 'A' satisfies Player;
export const BOT = 'B' satisfies Player;

/** Pause before the bot's take, so the player can follow it (PRD B5). */
export const BOT_DELAY_MS = 600;

/**
 * Schedules the bot's take for the turn `state` is at, after `BOT_DELAY_MS` (PRD B5), and delivers the next state.
 * Returns the cancel function; a cancelled schedule never delivers.
 */
export function scheduleBotTake(
  state: GameState,
  difficulty: Difficulty,
  deliver: (next: GameState) => void,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis,
): () => void {
  const scheduled = state.takes.length;
  const timer = timers.setTimeout(() => deliver(botStep(state, scheduled, difficulty)), BOT_DELAY_MS);
  return () => timers.clearTimeout(timer);
}

/** A fresh seed from the browser's cryptographic generator. Seeds are never shown (PRD S1). */
export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

/**
 * A new game on a seeded board (spec §2). Without a starter the seed chooses one at random, as for
 * the very first game; Play again passes `nextStarter` of the game before (spec §5).
 */
export function startGame(seed: number = generateSeed(), starter?: Player): GameState {
  return newGame(starter === undefined ? { seed } : { seed, starter });
}

/** The starter of the next game: the other player (spec §5). */
export function nextStarter(finished: Pick<GameState, 'starter'>): Player {
  return otherPlayer(finished.starter);
}

/** Whether the bot should take now: the game runs and it is the bot's turn. */
export function botToMove(state: GameState): boolean {
  return !state.result && state.toMove === BOT;
}

/** Whether the human may take now. */
export function humanToMove(state: GameState): boolean {
  return !state.result && state.toMove === HUMAN;
}

/**
 * The bot's take for the scheduled turn, given as the number of takes so far. Returns the state
 * unchanged when the turn has already moved on, which keeps StrictMode's double effects safe.
 */
export function botStep(state: GameState, scheduledTakes: number, difficulty: Difficulty): GameState {
  if (!botToMove(state) || state.takes.length !== scheduledTakes) return state;
  const taken = take(state, chooseTake(state, { difficulty }));
  return taken.ok ? taken.state : state;
}
