import { PLAYERS, TOKENS_PER_PLAYER, type GameState, type Player } from '@okiya/game';
import { HUMAN } from './match';
import { playerNumber, seatName, type GameMode } from './mode';
import type { Score } from './score';

/** An avatar's face (PRD U1): waiting, to move, after a win and after a loss. */
export const EXPRESSIONS = ['idle', 'to-move', 'won', 'lost'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** Everything one seat beside the board shows (PRD U2, I3). */
export interface SeatView {
  readonly player: Player;
  readonly number: 1 | 2;
  /** "Player 1", "Player 2", "You" or "Bot · Normal". */
  readonly name: string;
  /** The token's mark: a ring for Player 1, a diamond for Player 2. */
  readonly mark: 'ring' | 'diamond';
  readonly tokensLeft: number;
  readonly tokensTotal: number;
  /** "6 of 8 tokens left". */
  readonly tokensLabel: string;
  /** This seat's wins in the sitting. */
  readonly score: number;
  /** Lit in its player's colour: the seat to move of a running game. The other seat is dimmed. */
  readonly lit: boolean;
  /** The lit seat's label ("Your move", "Bot is thinking", "Player 1's move"), "Winner" or "Draw" at the end, else null. */
  readonly status: string | null;
  readonly expression: Expression;
}

/** Whose move it is, in words, or null once the game has ended. */
export function turnLabel(state: Pick<GameState, 'result' | 'toMove'>, mode: GameMode): string | null {
  if (state.result) return null;
  if (mode.kind === 'two-player') return `Player ${playerNumber(state.toMove)}'s move`;
  return state.toMove === HUMAN ? 'Your move' : 'Bot is thinking';
}

function expressionOf(state: GameState, player: Player): Expression {
  const { result } = state;
  if (!result) return state.toMove === player ? 'to-move' : 'idle';
  if (result.kind === 'draw') return 'idle';
  return result.winner === player ? 'won' : 'lost';
}

function statusOf(state: GameState, player: Player, mode: GameMode): string | null {
  const { result } = state;
  if (!result) return state.toMove === player ? turnLabel(state, mode) : null;
  if (result.kind === 'draw') return 'Draw';
  return result.winner === player ? 'Winner' : null;
}

/** Both seats, Player 1 first. */
export function seatModels(state: GameState, mode: GameMode, score: Score): readonly [SeatView, SeatView] {
  const seat = (player: Player): SeatView => {
    const left = TOKENS_PER_PLAYER - state.tokens.filter((token) => token === player).length;
    return {
      player,
      number: playerNumber(player),
      name: seatName(mode, player),
      mark: player === 'A' ? 'ring' : 'diamond',
      tokensLeft: left,
      tokensTotal: TOKENS_PER_PLAYER,
      tokensLabel: `${left} of ${TOKENS_PER_PLAYER} tokens left`,
      score: score[player],
      lit: !state.result && state.toMove === player,
      status: statusOf(state, player, mode),
      expression: expressionOf(state, player),
    };
  };
  return [seat(PLAYERS[0]), seat(PLAYERS[1])];
}
