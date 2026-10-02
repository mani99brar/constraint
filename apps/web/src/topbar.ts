import { otherPlayer, TOKENS_PER_PLAYER, type GameState, type Player, type Terrain, type TileSymbol } from '@okiya/game';
import { resultSummary, tileName } from './text';

/** One half of the last tile as the top bar draws it: an emblem with its name (PRD I1, U2). */
export type LastTileEmblem =
  | { readonly kind: 'terrain'; readonly terrain: Terrain; readonly name: string }
  | { readonly kind: 'symbol'; readonly symbol: TileSymbol; readonly name: string };

/** One player's tokens still to place, out of 8. */
export interface TokenCount {
  readonly player: Player;
  readonly side: 'You' | 'Bot';
  readonly left: number;
  readonly total: number;
  readonly label: string;
}

/** Everything the slim top bar shows (PRD U2). */
export interface TopBarModel {
  /** "Your turn", "Bot is thinking", or the result once the game has ended. */
  readonly turnText: string;
  readonly humanTurn: boolean;
  readonly botThinking: boolean;
  /** "You start" or "Bot starts" before the opening take; null afterwards. */
  readonly starterText: string | null;
  /** Terrain then symbol; null before the opening take. */
  readonly lastTile: readonly [LastTileEmblem, LastTileEmblem] | null;
  /** The last tile in words, or "Any edge tile" at the opening. */
  readonly lastTileLabel: string;
  /** Yours first, then the bot's. */
  readonly counts: readonly [TokenCount, TokenCount];
}

export const OPENING_LABEL = 'Any edge tile';

function tokenCount(state: GameState, player: Player, human: Player): TokenCount {
  const placed = state.tokens.filter((token) => token === player).length;
  const left = TOKENS_PER_PLAYER - placed;
  const side = player === human ? 'You' : 'Bot';
  const whose = player === human ? 'Your' : "Bot's";
  return { player, side, left, total: TOKENS_PER_PLAYER, label: `${whose} tokens: ${left} of ${TOKENS_PER_PLAYER} left` };
}

export function topBarModel(state: GameState, human: Player): TopBarModel {
  const over = state.result !== null;
  const humanTurn = !over && state.toMove === human;
  const { lastTile } = state;
  return {
    turnText: state.result ? resultSummary(state.result, human) : humanTurn ? 'Your turn' : 'Bot is thinking',
    humanTurn,
    botThinking: !over && !humanTurn,
    starterText: state.takes.length === 0 ? (state.starter === human ? 'You start' : 'Bot starts') : null,
    lastTile: lastTile
      ? [
          { kind: 'terrain', terrain: lastTile.terrain, name: lastTile.terrain },
          { kind: 'symbol', symbol: lastTile.symbol, name: lastTile.symbol },
        ]
      : null,
    lastTileLabel: lastTile ? `Last tile: ${tileName(lastTile)}` : OPENING_LABEL,
    counts: [tokenCount(state, human, human), tokenCount(state, otherPlayer(human), human)],
  };
}
