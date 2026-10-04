import type { GameState, Player } from '@okiya/game';
import type { ClockTimes } from './clock';
import { difficultyLabel, type Difficulty } from './difficulty';
import { HUMAN } from './match';

/**
 * How a game is played (PRD S1, §5.8): against the bot at a difficulty, or by two players on one
 * device. Player 1 is the engine's player A and Player 2 is B; in a bot game the human is Player 1.
 * A two-player game may be timed: `clock` holds each player's starting time (null for no clock).
 */
export type GameMode = { readonly kind: 'bot'; readonly difficulty: Difficulty } | { readonly kind: 'two-player'; readonly clock?: ClockTimes };

export const TWO_PLAYERS: GameMode = { kind: 'two-player' };

/** A two-player game, timed when `clock` is given. */
export function twoPlayers(clock: ClockTimes | null): GameMode {
  return clock ? { kind: 'two-player', clock } : TWO_PLAYERS;
}

/** A timed game's starting times, or null. */
export function clockOf(mode: GameMode): ClockTimes | null {
  return mode.kind === 'two-player' && mode.clock ? mode.clock : null;
}

export function versusBot(difficulty: Difficulty): GameMode {
  return { kind: 'bot', difficulty };
}

export function isBotGame(mode: GameMode): mode is { readonly kind: 'bot'; readonly difficulty: Difficulty } {
  return mode.kind === 'bot';
}

/** Player 1 or Player 2. */
export function playerNumber(player: Player): 1 | 2 {
  return player === 'A' ? 1 : 2;
}

/** Whether a person takes for `player`: both seats in a two-player game, only Player 1 against the bot. */
export function isPerson(mode: GameMode, player: Player): boolean {
  return mode.kind === 'two-player' || player === HUMAN;
}

/** Whether a person may take now: the game runs and a person's seat is to move. */
export function personToMove(state: GameState, mode: GameMode): boolean {
  return !state.result && isPerson(mode, state.toMove);
}

/** A seat's name (PRD U2): "Player 1" and "Player 2", or "You" and "Bot · Normal". */
export function seatName(mode: GameMode, player: Player): string {
  if (mode.kind === 'two-player') return `Player ${playerNumber(player)}`;
  return player === HUMAN ? 'You' : `Bot · ${difficultyLabel(mode.difficulty)}`;
}

/** A seat in running text: "You", "Bot" or "Player 1". */
export function shortName(mode: GameMode, player: Player): string {
  if (mode.kind === 'two-player') return `Player ${playerNumber(player)}`;
  return player === HUMAN ? 'You' : 'Bot';
}

/** A seat's possessive in running text: "your", "bot's" or "Player 1's". */
export function possessive(mode: GameMode, player: Player): string {
  if (mode.kind === 'two-player') return `Player ${playerNumber(player)}'s`;
  return player === HUMAN ? 'your' : "bot's";
}

/** The mode in a few words, for Continue: "Normal bot" or "Two players". */
export function modeLabel(mode: GameMode): string {
  if (mode.kind === 'two-player') return clockOf(mode) ? 'Two players, timed' : 'Two players';
  return `${difficultyLabel(mode.difficulty)} bot`;
}
