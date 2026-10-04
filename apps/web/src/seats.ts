import { PLAYERS, TOKENS_PER_PLAYER, type GameState, type Player } from '@okiya/game';
import { clockText, clockWords, LOW_CLOCK_MS, type ClockTimes } from './clock';
import { HUMAN } from './match';
import { playerNumber, seatName, type GameMode } from './mode';
import { avatarLooks, NO_EVENT, type Expression, type Reaction, type ReactionEvent } from './reactions';
import type { Score } from './score';

export { EXPRESSIONS, type Expression } from './reactions';

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
  /** The avatar's resting face (PRD U9). */
  readonly expression: Expression;
  /** The avatar's one-shot motion for the last event, or null. */
  readonly reaction: Reaction | null;
  /** Counts the events, so the same motion twice in a row plays twice. */
  readonly reactionKey: number;
  /** This seat's clock in a timed game, beside its name; null without one. */
  readonly clock: SeatClock | null;
}

/** A seat's clock as shown: "2:45", in words for screen readers, running or stopped, low under ten seconds. */
export interface SeatClock {
  readonly text: string;
  /** "Player 1's clock, 2 minutes 45 seconds left". */
  readonly label: string;
  readonly ms: number;
  readonly running: boolean;
  readonly low: boolean;
}

/** A seat's clock from the time left and whose clock runs. */
export function seatClock(name: string, ms: number | null, running: boolean): SeatClock | null {
  if (ms === null) return null;
  return { text: clockText(ms), label: `${name}'s clock, ${clockWords(ms)}`, ms, running, low: ms < LOW_CLOCK_MS };
}

/** Whose move it is, in words, or null once the game has ended. */
export function turnLabel(state: Pick<GameState, 'result' | 'toMove'>, mode: GameMode): string | null {
  if (state.result) return null;
  if (mode.kind === 'two-player') return `Player ${playerNumber(state.toMove)}'s move`;
  return state.toMove === HUMAN ? 'Your move' : 'Bot is thinking';
}

function statusOf(state: GameState, player: Player, mode: GameMode): string | null {
  const { result } = state;
  if (!result) return state.toMove === player ? turnLabel(state, mode) : null;
  if (result.kind === 'draw') return 'Draw';
  return result.winner === player ? 'Winner' : null;
}

/** Both seats, Player 1 first, with the avatars' reactions to the last event (none by default). */
export function seatModels(
  state: GameState,
  mode: GameMode,
  score: Score,
  event: ReactionEvent = NO_EVENT,
  reactionKey = 0,
  clock: { readonly times: ClockTimes; readonly running: Player | null } | null = null,
): readonly [SeatView, SeatView] {
  const looks = avatarLooks(state, event, mode, reactionKey);
  const seat = (player: Player): SeatView => {
    const look = looks[player === 'A' ? 0 : 1];
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
      expression: look.expression,
      reaction: look.reaction,
      reactionKey: look.key,
      clock: clock ? seatClock(seatName(mode, player), clock.times[player], clock.running === player) : null,
    };
  };
  return [seat(PLAYERS[0]), seat(PLAYERS[1])];
}
