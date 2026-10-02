import { chooseSetup } from '@okiya/bot';
import { defaultSetup, SPEC_V0_2, TILES } from '@okiya/content';
import { prepareMatch, startMatch, type MatchState, type PlayerId } from '@okiya/rules';

/** The human always plays A with the default roster; the bot plays B. */
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

/** Prepares the board from the seed, then starts the match from both sides' setups (spec §5). */
export function createMatch(seed: number): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
  const botSetup = chooseSetup({ board: prepared.board, preset: SPEC_V0_2, seed });
  return startMatch(prepared, { [HUMAN]: defaultSetup(HUMAN), [BOT]: botSetup });
}
