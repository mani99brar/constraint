import { chooseAction, chooseSetup } from '@okiya/bot';
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

/** Pause before the bot's move, so the player can follow it (PRD B4). */
export const BOT_DELAY_MS = 600;

const MAX_SEED = 0xffff_ffff;

export function parseSeed(text: string | null): number | null {
  if (text === null || !/^\d+$/.test(text.trim())) return null;
  const seed = Number(text.trim());
  return seed <= MAX_SEED ? seed : null;
}

export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

/** The seed field's initial text: the `?seed=` parameter of the page, or empty. */
export function seedTextFromSearch(search: string): string {
  return new URLSearchParams(search).get('seed') ?? '';
}

export type SeedChoice = { readonly ok: true; readonly seed: number } | { readonly ok: false; readonly error: string };

/** The match seed from the field: generated when the field is empty (PRD S1), refused when malformed. */
export function chooseSeed(text: string, generate: () => number = generateSeed): SeedChoice {
  if (text.trim() === '') return { ok: true, seed: generate() };
  const seed = parseSeed(text);
  return seed === null ? { ok: false, error: 'The seed must be a whole number from 0 to 4294967295.' } : { ok: true, seed };
}

/** Setup phase one (spec §5 step 1): the board the seed reveals, before either side chooses. */
export function prepare(seed: number): PreparedMatch {
  return prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
}

/**
 * Starts the match from the human's setup and the bot's (spec §5). The bot's setup uses its own
 * private seed, never shown, so the displayed match seed cannot reveal the bot's traps.
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
export function botStep(state: MatchState, scheduledTurn: number = state.turn): MatchState {
  if (!botToMove(state) || state.turn !== scheduledTurn) return state;
  const view = playerView(state, BOT);
  const applied = applyAction(state, chooseAction(view, listLegalActions(state)));
  return applied.ok ? applied.state : state;
}
