import { ALL_CELLS, isEdgeCell, legalTakes, tileAt, tokenAt, type CellId, type GameState, type Player, type Tile } from '@okiya/game';
import { endModel, type EndMark, type EndModel } from './end';
import { personToMove, possessive, type GameMode } from './mode';
import { tileName } from './text';

/** Everything one cell of the board shows (PRD U1, I1, I2, R4). */
export interface CellView {
  readonly cell: CellId;
  /** The tile laid here at setup; shown only while `token` is null. */
  readonly tile: Tile;
  /** The taker's token, shown instead of the tile once it is taken. */
  readonly token: Player | null;
  readonly edge: boolean;
  /** A legal take for the person to move right now, whether or not it glows. */
  readonly legal: boolean;
  /**
   * Stands out for the person to move: a legal take with highlights on. It pops up when the turn starts,
   * then stays raised with a halo, a ring and a tint of the mover's colour and the mover's badge (PRD R2).
   */
  readonly glow: boolean;
  /** A glowing tile's place in the pop, 0 for the first in board order; else null. */
  readonly popOrder: number | null;
  /** Fades back: a free tile that is not a legal take, while a person is to move with highlights on. */
  readonly faded: boolean;
  /** The latest take, marked until the next one by a ring in its taker's colour (PRD I2). */
  readonly last: boolean;
  /** One of the winning shape's four cells, once the game has ended. */
  readonly winning: boolean;
  /** Its part in the end sequence (PRD U10), once the game has ended; else null. */
  readonly end: EndMark | null;
  /** A lifting token's place in the end sequence, 0 to 3; else null. */
  readonly liftOrder: number | null;
  /** The accessible name, for example "B3, Water–Moon, legal take", "B3, your token" or "B3, Player 2's token". */
  readonly label: string;
}

/** The winning line or square, which a stroke runs across at the end (PRD R4). */
export interface WinningShape {
  readonly by: 'line' | 'square';
  readonly cells: readonly CellId[];
}

export interface BoardModel {
  readonly cells: readonly CellView[];
  /** The glowing cells, in board order: `legalTakes` on a person's turn with highlights on, else none. */
  readonly glowing: readonly CellId[];
  /** Whose colour rings and tints the glowing tiles: the person to move while any tile glows, else null. */
  readonly mover: Player | null;
  /** The mark on the glowing tiles' corner badge: the mover's token mark, a ring or a diamond; else null. */
  readonly badge: TokenMarkShape | null;
  /**
   * The turn's parity while any tile glows, which picks one of two identical pop animations, so the pop
   * restarts on every turn, even for a tile that stays legal across a turn change; else null.
   */
  readonly popTurn: 'odd' | 'even' | null;
  /** Whether a tap may take a tile: a person's turn of a running game. */
  readonly acceptsTakes: boolean;
  readonly winningShape: WinningShape | null;
  /** The end sequence of a finished game, else null. */
  readonly end: EndModel | null;
  /** Whether every tile shows its name on a plate (the Tile names setting, PRD E3). */
  readonly names: boolean;
}

export type TokenMarkShape = 'ring' | 'diamond';

/** A player's token mark: a ring for Player 1, a diamond for Player 2 (PRD U1). */
export function markOf(player: Player): TokenMarkShape {
  return player === 'A' ? 'ring' : 'diamond';
}

export interface BoardOptions {
  readonly mode: GameMode;
  readonly highlights: boolean;
  readonly tileNames?: boolean;
}

function winningShapeOf(state: GameState): WinningShape | null {
  const { result } = state;
  return result?.kind === 'win' && result.by !== 'blockade' ? { by: result.by, cells: result.cells } : null;
}

/**
 * The board as the person to move sees it. Nothing pops, fades, glows or carries a tint or badge while no
 * person is to move (the bot choosing, or the game over) or with highlights off, so the board stays still
 * on the bot's turn.
 */
export function boardModel(state: GameState, { mode, highlights, tileNames = false }: BoardOptions): BoardModel {
  const acceptsTakes = personToMove(state, mode);
  const legal = new Set(acceptsTakes ? legalTakes(state) : []);
  const end = endModel(state);
  const last = state.takes[state.takes.length - 1] ?? null;
  const shape = winningShapeOf(state);
  const winning = new Set(shape?.cells ?? []);
  const cells = ALL_CELLS.map((cell): CellView => {
    const tile = tileAt(state, cell);
    const token = tokenAt(state, cell);
    const glow = highlights && legal.has(cell);
    const faded = highlights && acceptsTakes && token === null && !legal.has(cell);
    const ending = end?.cells.find((view) => view.cell === cell);
    const parts: string[] = [cell, token === null ? tileName(tile) : `${possessive(mode, token)} token`];
    if (glow) parts.push('legal take');
    if (cell === last) parts.push('last take');
    if (winning.has(cell)) parts.push(`winning ${shape!.by}`);
    return {
      cell,
      tile,
      token,
      edge: isEdgeCell(cell),
      legal: legal.has(cell),
      glow,
      popOrder: null,
      faded,
      last: cell === last,
      winning: winning.has(cell),
      end: ending?.mark ?? null,
      liftOrder: ending?.liftOrder ?? null,
      label: parts.join(', '),
    };
  });
  const glowing = cells.filter((view) => view.glow).map((view) => view.cell);
  const mover = glowing.length > 0 ? state.toMove : null;
  return {
    cells: cells.map((view) => (view.glow ? { ...view, popOrder: glowing.indexOf(view.cell) } : view)),
    glowing,
    mover,
    badge: mover ? markOf(mover) : null,
    popTurn: mover ? (state.takes.length % 2 === 1 ? 'odd' : 'even') : null,
    acceptsTakes,
    winningShape: shape,
    end,
    names: tileNames,
  };
}
