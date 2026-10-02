import { tileAt, type CellId, type GameResult, type GameState, type Player, type TakeRefusal, type Tile } from '@okiya/game';

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

const SHAPE_WORDS = { line: 'a line', square: 'a square' } as const;

/** The result in a few words, for the top bar, the toast and the end screen's heading (PRD R4). */
export function resultSummary(result: GameResult, human: Player): string {
  if (result.kind === 'draw') return 'Draw: the board is full';
  const winner = result.winner === human ? 'You win' : 'The bot wins';
  return result.by === 'blockade' ? `${winner} by blockade` : `${winner} with ${SHAPE_WORDS[result.by]}`;
}

/** How the game ended, in a sentence: the shape and its cells, the blockade and its last tile, or the full board. */
export function resultDetail(state: Pick<GameState, 'result' | 'lastTile'>, human: Player): string {
  const { result } = state;
  if (!result) return '';
  if (result.kind === 'draw') return 'All 16 cells hold tokens and nobody made a line or a square.';
  const yours = result.winner === human;
  if (result.by === 'blockade') {
    const stuck = yours ? 'the bot cannot take one and loses' : 'you cannot take one and lose';
    const last = state.lastTile ? tileName(state.lastTile) : 'the last tile';
    return `No tile left on the board matches ${last}, so ${stuck}.`;
  }
  const whose = yours ? 'Your' : "The bot's";
  const shape = result.by === 'line' ? 'make a line' : 'fill a 2×2 square';
  return `${whose} tokens on ${cellList(result.cells)} ${shape}.`;
}
