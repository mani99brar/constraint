import { otherPlayer, PLAYERS, type GameState, type Player } from '@okiya/game';
import { isPerson, type GameMode } from './mode';

/**
 * The avatars' reactions (PRD U9): what just happened, never the position on the board, so no reaction
 * hints at a threat. Each avatar has a resting face and, on top, a one-shot motion for the last event.
 */

/** A resting face: waiting, ready to move, the bot thinking, after a win and after a loss. */
export const EXPRESSIONS = ['idle', 'to-move', 'thinking', 'won', 'lost'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** A one-shot motion: a nod on a take, a glance at the other's take, a wince at a refusal, a bounce on a win. */
export const REACTIONS = ['nod', 'glance', 'wince', 'bounce'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** The last event of a game on screen. The start of a game and a resumed game are no event. */
export type ReactionEvent = { readonly kind: 'none' } | { readonly kind: 'take'; readonly by: Player } | { readonly kind: 'refusal'; readonly by: Player };

export const NO_EVENT: ReactionEvent = { kind: 'none' };

/** One avatar's look: its resting face, its motion (null for none) and the key that replays the motion. */
export interface AvatarLook {
  readonly expression: Expression;
  readonly reaction: Reaction | null;
  readonly key: number;
}

/** The part of a game state the reactions read: whose move it is and the result, never the board. */
export type ReactionState = Pick<GameState, 'toMove' | 'result'>;

/** The resting face: the player to move is ready (the bot thinks), the other waits; at the end won and lost, or idle on a draw. */
export function restingFace(state: ReactionState, mode: GameMode, player: Player): Expression {
  const { result } = state;
  if (result) return result.kind === 'draw' ? 'idle' : result.winner === player ? 'won' : 'lost';
  if (state.toMove !== player) return 'idle';
  return isPerson(mode, player) ? 'to-move' : 'thinking';
}

/** The motion the last event gives `player`, or null. */
export function reactionOf(state: ReactionState, event: ReactionEvent, player: Player): Reaction | null {
  switch (event.kind) {
    case 'none':
      return null;
    case 'refusal':
      return event.by === player ? 'wince' : null;
    case 'take': {
      const { result } = state;
      if (result) return result.kind === 'win' && result.winner === player ? 'bounce' : null;
      return event.by === player ? 'nod' : 'glance';
    }
  }
}

/** Both avatars' looks, Player 1 first, for the state, the last event and the mode. */
export function avatarLooks(state: ReactionState, event: ReactionEvent, mode: GameMode, key: number): readonly [AvatarLook, AvatarLook] {
  const look = (player: Player): AvatarLook => ({ expression: restingFace(state, mode, player), reaction: reactionOf(state, event, player), key });
  return [look(PLAYERS[0]), look(PLAYERS[1])];
}

/** The newest refused tap: who tapped, how many takes there were then, and how many refusals so far. */
export interface RefusalMark {
  readonly by: Player;
  readonly atTakes: number;
  readonly count: number;
}

/**
 * The last event and its key, derived from the game as it is on screen: the takes made since the game
 * was shown (`shownAtTakes`, so a resumed game starts with none) and the newest refusal. A refusal is
 * the last event until the next take. Every take and every refusal adds one to the key, so the same
 * reaction twice in a row plays twice.
 */
export function lastEvent(state: Pick<GameState, 'toMove' | 'takes'>, shownAtTakes: number, refusal: RefusalMark | null): { readonly event: ReactionEvent; readonly key: number } {
  const takes = state.takes.length;
  const key = Math.max(0, takes - shownAtTakes) + (refusal?.count ?? 0);
  if (refusal && refusal.atTakes === takes) return { event: { kind: 'refusal', by: refusal.by }, key };
  // The engine passes the turn on every take, the last one included, so the taker is not the player to move.
  if (takes > shownAtTakes) return { event: { kind: 'take', by: otherPlayer(state.toMove) }, key };
  return { event: NO_EVENT, key };
}
