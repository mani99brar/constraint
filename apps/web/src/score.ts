import { PLAYERS, type GameResult, type Player } from '@okiya/game';
import { markOf, type TokenMarkShape } from './boardModel';
import { playerNumber, shortName, type GameMode } from './mode';
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

/** One seat's side of the scoreboard (PRD U2, P3): its wins in the sitting, in its player's colour with its token mark. */
export interface ScoreSide {
  readonly player: Player;
  readonly number: 1 | 2;
  /** "You", "Bot", "Player 1" or "Player 2". */
  readonly name: string;
  readonly mark: TokenMarkShape;
  readonly wins: number;
}

/** The scoreboard row above the board: Player 1's score, the Match card, Player 2's score, and the draws under the card. */
export interface ScoreboardModel {
  readonly sides: readonly [ScoreSide, ScoreSide];
  readonly draws: number;
  /** "1 draw" or "2 draws", small under the Match card; null at zero, when the line stays hidden. */
  readonly drawsText: string | null;
  /** The scoreboard's accessible name: "You 2, Bot 1, 1 draw" or "Player 1 0, Player 2 0". */
  readonly label: string;
}

export function scoreboardModel(score: Score, mode: GameMode): ScoreboardModel {
  const side = (player: Player): ScoreSide => ({ player, number: playerNumber(player), name: shortName(mode, player), mark: markOf(player), wins: score[player] });
  const sides = [side(PLAYERS[0]), side(PLAYERS[1])] as const;
  const drawsText = score.draws === 0 ? null : `${score.draws} ${score.draws === 1 ? 'draw' : 'draws'}`;
  return { sides, draws: score.draws, drawsText, label: [...sides.map(({ name, wins }) => `${name} ${wins}`), ...(drawsText ? [drawsText] : [])].join(', ') };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Whether stored data is a score: a non-negative whole number for each seat and the draws. */
export function isScore(value: unknown): value is Score {
  return isRecord(value) && PLAYERS.every((player) => isCount(value[player])) && isCount(value.draws);
}
