import { otherPlayer, ROWS, tileAt, type CellId, type GameResult, type GameState, type Player, type TakeRefusal, type Tile } from '@okiya/game';
import { HUMAN } from './match';
import { possessive, shortName, type GameMode } from './mode';

export function tileName(tile: Tile): string {
  return `${tile.terrain}–${tile.symbol}`;
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
      return 'That is not a tile of the board.';
    case 'cell-taken':
      return `${tileName(tileAt(state, refusal.cell))} was already taken; a token stands there now.`;
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
 * the start", "That tile is already taken" or "Desert–Moon doesn't match Forest–Star". The full reason stays in
 * the announcement.
 */
export function shortRefusal(refusal: TakeRefusal): string {
  switch (refusal.code) {
    case 'game-over':
      return 'The game is over';
    case 'unknown-cell':
      return 'Not a tile';
    case 'cell-taken':
      return 'That tile is already taken';
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
  return `${whose} four tokens ${result.by === 'line' ? lineWords(result.cells) : squareWords(result.cells)}.`;
}

const ORDINALS = ['first', 'second', 'third', 'fourth'] as const;

/** Where a winning line runs, in words the board shows without coordinates: "fill the second row", "fill the third column", "run corner to corner". */
function lineWords(cells: readonly CellId[]): string {
  const rows = new Set(cells.map((cell) => ROWS.indexOf(cell[0] as (typeof ROWS)[number])));
  const columns = new Set(cells.map((cell) => Number(cell[1]) - 1));
  if (rows.size === 1) return `fill the ${ORDINALS[[...rows][0]!]} row`;
  if (columns.size === 1) return `fill the ${ORDINALS[[...columns][0]!]} column`;
  const [first] = cells.slice().sort();
  return first!.endsWith('1') ? 'run corner to corner' : 'run corner to corner';
}

/** Where a winning 2×2 square sits: "make a 2×2 square at the top left", "in the centre". */
function squareWords(cells: readonly CellId[]): string {
  const row = Math.min(...cells.map((cell) => ROWS.indexOf(cell[0] as (typeof ROWS)[number])));
  const column = Math.min(...cells.map((cell) => Number(cell[1]) - 1));
  const vertical = ['top', 'middle', 'bottom'][row]!;
  const horizontal = ['left', 'centre', 'right'][column]!;
  if (vertical === 'middle' && horizontal === 'centre') return 'make a 2×2 square in the centre';
  return `make a 2×2 square at the ${vertical === 'middle' ? 'middle' : vertical} ${horizontal}`;
}
