import { otherPlayer, tileAt, type CellId, type GameResult, type GameState, type Player, type TakeRefusal, type Tile } from '@okiya/game';
import { HUMAN } from './match';
import { possessive, shortName, type GameMode } from './mode';

export function tileName(tile: Tile): string {
  return `${tile.terrain}–${tile.symbol}`;
}

/** A list of cells in words, for example "A1, B2, C3 and D4". */
export function cellList(cells: readonly CellId[]): string {
  if (cells.length <= 1) return cells.join('');
  return `${cells.slice(0, -1).join(', ')} and ${cells[cells.length - 1]}`;
}

/**
 * Readable reason for a refused take (PRD R3), naming the tile and the last tile, for example
 * "Desert–Moon matches neither Forest nor Star".
 */
export function describeRefusal(refusal: TakeRefusal, state: GameState): string {
  switch (refusal.code) {
    case 'game-over':
      return 'The game is over: no more tiles can be taken.';
    case 'unknown-cell':
      return `${refusal.cell} is not a cell of the board.`;
    case 'cell-taken':
      return `${tileName(tileAt(state, refusal.cell))} at ${refusal.cell} was already taken; a token stands there now.`;
    case 'not-edge':
      return `${tileName(tileAt(state, refusal.cell))} is not an edge tile; the first take must come from the edge.`;
    case 'no-match':
      return `${tileName(refusal.tile)} matches neither ${refusal.lastTile.terrain} nor ${refusal.lastTile.symbol}`;
    default:
      return `That take is not allowed (${(refusal as { code: string }).code}).`;
  }
}

/**
 * A refusal in one short line for a phone's toast (PRD R3, U6), chosen by its kind: "Edge tiles only at
 * the start", "D3 is already taken" or "Desert–Moon doesn't match Forest–Star". The full reason stays in
 * the announcement.
 */
export function shortRefusal(refusal: TakeRefusal): string {
  switch (refusal.code) {
    case 'game-over':
      return 'The game is over';
    case 'unknown-cell':
      return `${refusal.cell} is not a cell`;
    case 'cell-taken':
      return `${refusal.cell} is already taken`;
    case 'not-edge':
      return 'Edge tiles only at the start';
    case 'no-match':
      return `${tileName(refusal.tile)} doesn't match ${tileName(refusal.lastTile)}`;
    default:
      return 'Not allowed';
  }
}

const SHAPE_WORDS = { line: 'a line', square: 'a square', blockade: 'blockade' } as const;

/** Who won, as the subject of a sentence: "You win", "The bot wins" or "Player 2 wins". */
function winnerPhrase(winner: Player, mode: GameMode): string {
  if (mode.kind === 'two-player') return `${shortName(mode, winner)} wins`;
  return winner === HUMAN ? 'You win' : 'The bot wins';
}

/**
 * The result in a few words, for the end screen's heading (PRD R4), naming the seat in a two-player
 * game: "Player 2 wins by a square", "You win by blockade", "Player 1 wins on time" or "Draw: the board is full".
 */
export function resultSummary(result: GameResult, mode: GameMode): string {
  if (result.kind === 'draw') return 'Draw: the board is full';
  if (result.by === 'time') return `${winnerPhrase(result.winner, mode)} on time`;
  return `${winnerPhrase(result.winner, mode)} by ${SHAPE_WORDS[result.by]}`;
}

/** How the game ended, in a sentence: the shape and its cells, the blockade and its last tile, or the full board. */
export function resultDetail(state: Pick<GameState, 'result' | 'lastTile'>, mode: GameMode): string {
  const { result } = state;
  if (!result) return '';
  if (result.kind === 'draw') return 'All 16 cells hold tokens and nobody made a line or a square.';
  if (result.by === 'time') {
    const loser = possessive(mode, otherPlayer(result.winner));
    const whose = loser === 'your' ? 'Your' : loser === "bot's" ? "The bot's" : loser;
    return `${whose} clock ran out.`;
  }
  if (result.by === 'blockade') {
    const loser = otherPlayer(result.winner);
    const stuck =
      mode.kind === 'two-player'
        ? `${shortName(mode, loser)} cannot take one and loses`
        : loser === HUMAN
          ? 'you cannot take one and lose'
          : 'the bot cannot take one and loses';
    const last = state.lastTile ? tileName(state.lastTile) : 'the last tile';
    return `No tile left on the board matches ${last}, so ${stuck}.`;
  }
  const owner = possessive(mode, result.winner);
  const whose = owner === 'your' ? 'Your' : owner === "bot's" ? "The bot's" : owner;
  const shape = result.by === 'line' ? 'make a line' : 'fill a 2×2 square';
  return `${whose} tokens on ${cellList(result.cells)} ${shape}.`;
}
