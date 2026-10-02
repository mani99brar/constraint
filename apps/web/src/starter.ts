import { otherPlayer, PLAYERS, type Player } from '@okiya/game';
import { readText, writeJson, type KeyValueStorage } from './storage';

/**
 * Who starts (spec §5): the very first game's starter is random, and every later game, from Play again or
 * from New game on the title screen, starts with the other player. The last starter is kept in the browser.
 */
export const LAST_STARTER_KEY = 'okiya.last-starter';

/** Remembers who started the game now being played. */
export function rememberStarter(storage: KeyValueStorage | null, starter: Player): boolean {
  return writeJson(storage, LAST_STARTER_KEY, starter);
}

/** The starter of a new game: the other player than last time, or undefined (random) when none is known. */
export function starterForNewGame(storage: KeyValueStorage | null): Player | undefined {
  const text = readText(storage, LAST_STARTER_KEY);
  let last: unknown;
  try {
    last = text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
  return (PLAYERS as readonly unknown[]).includes(last) ? otherPlayer(last as Player) : undefined;
}
