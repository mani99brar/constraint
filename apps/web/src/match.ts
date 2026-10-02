import { chooseAction, chooseSetup, type SearchOptions } from '@okiya/bot';
import { SPEC_V0_2, TILES } from '@okiya/content';
import {
  applyAction,
  listLegalActions,
  playerView,
  prepareMatch,
  startMatch,
  type MatchState,
  type PlayerId,
  type PreparedMatch,
  type Setup,
} from '@okiya/rules';

/** The human always plays A; the bot plays B. */
export const HUMAN = 'A' satisfies PlayerId;
export const BOT = 'B' satisfies PlayerId;

/** The published game always plays the spec's current defaults (PRD E1). */
export const PRESET = SPEC_V0_2;

/** Pause before the bot's move, so the player can follow it (PRD B4). */
export const BOT_DELAY_MS = 600;

/** A fresh seed from the browser's cryptographic generator. Seeds are never shown (PRD E1). */
export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

/** Setup phase one (spec §5 step 1): the board the seed reveals, before either side chooses. */
export function prepare(seed: number = generateSeed()): PreparedMatch {
  return prepareMatch({ tiles: TILES, preset: PRESET, seed });
}

/**
 * Starts the match from the human's setup and the bot's (spec §5). The bot's setup uses its own
 * private seed, independent of the match seed, so the match's randomness cannot reveal its traps.
 */
export function createMatch(prepared: PreparedMatch, humanSetup: Setup, botPrivateSeed: number = generateSeed()): MatchState {
  const botSetup = chooseSetup({ board: prepared.board, preset: prepared.preset, privateSeed: botPrivateSeed });
  return startMatch(prepared, { [HUMAN]: humanSetup, [BOT]: botSetup });
}

/** Whether the bot should move now: the match runs and it is the bot's turn. */
export function botToMove(state: MatchState): boolean {
  return !state.result && state.activePlayer === BOT;
}

/**
 * The bot's move for the scheduled turn, chosen from its own player view. Returns the state
 * unchanged when the turn has already moved on, which keeps StrictMode's double effects safe.
 */
export function botStep(state: MatchState, scheduledTurn: number = state.turn, options: SearchOptions = {}): MatchState {
  if (!botToMove(state) || state.turn !== scheduledTurn) return state;
  const view = playerView(state, BOT);
  const applied = applyAction(state, chooseAction(view, listLegalActions(state), options));
  return applied.ok ? applied.state : state;
}
