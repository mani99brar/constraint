import { PLAYERS, type GameResult } from '@okiya/game';
import type { GameMode } from './mode';
import { isRecord } from './storage';

/**
 * The score of a sitting (PRD P3): each seat's wins and the draws, from the first game after New game.
 * Play again keeps it; leaving to the title screen or starting a New game ends the sitting.
 */
export interface Score {
  readonly A: number;
  readonly B: number;
  readonly draws: number;
}

export const NO_SCORE: Score = { A: 0, B: 0, draws: 0 };

/** The score with one finished game added. */
export function addResult(score: Score, result: GameResult): Score {
  if (result.kind === 'draw') return { ...score, draws: score.draws + 1 };
  return { ...score, [result.winner]: score[result.winner] + 1 };
}

export type SittingEvent = 'play-again' | 'new-game' | 'leave';

/** The score after leaving a finished or running game: Play again keeps it, anything else starts a new sitting. */
export function scoreAfter(event: SittingEvent, score: Score): Score {
  return event === 'play-again' ? score : NO_SCORE;
}

/** "Player 1 2 – 1 Player 2 · 1 draw", or "You 1 – 2 Bot". */
export function scoreText(score: Score, mode: GameMode): string {
  const [one, two] = mode.kind === 'two-player' ? ['Player 1', 'Player 2'] : ['You', 'Bot'];
  const draws = score.draws === 0 ? '' : ` · ${score.draws} ${score.draws === 1 ? 'draw' : 'draws'}`;
  return `${one} ${score.A} – ${score.B} ${two}${draws}`;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Whether stored data is a score: a non-negative whole number for each seat and the draws. */
export function isScore(value: unknown): value is Score {
  return isRecord(value) && PLAYERS.every((player) => isCount(value[player])) && isCount(value.draws);
}
