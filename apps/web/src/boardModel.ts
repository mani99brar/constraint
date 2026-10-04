import { ALL_CELLS, isEdgeCell, legalTakes, tileAt, tokenAt, type CellId, type GameState, type Player, type Tile } from '@okiya/game';
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
  /** Glows in the colour of the player to move: a legal take with highlights on. */
  readonly glow: boolean;
  /** The latest take, marked until the next one. */
  readonly last: boolean;
  /** One of the winning shape's four cells, once the game has ended. */
  readonly winning: boolean;
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
  /** Whose colour the glow and the board frame take: the player to move of a running game, else null. */
  readonly active: Player | null;
  /** Whether a tap may take a tile: a person's turn of a running game. */
  readonly acceptsTakes: boolean;
  readonly winningShape: WinningShape | null;
}

export interface BoardOptions {
  readonly mode: GameMode;
  readonly highlights: boolean;
}

function winningShapeOf(state: GameState): WinningShape | null {
  const { result } = state;
  return result?.kind === 'win' && result.by !== 'blockade' ? { by: result.by, cells: result.cells } : null;
}

export function boardModel(state: GameState, { mode, highlights }: BoardOptions): BoardModel {
  const acceptsTakes = personToMove(state, mode);
  const legal = new Set(acceptsTakes ? legalTakes(state) : []);
  const last = state.takes[state.takes.length - 1] ?? null;
  const shape = winningShapeOf(state);
  const winning = new Set(shape?.cells ?? []);
  const cells = ALL_CELLS.map((cell): CellView => {
    const tile = tileAt(state, cell);
    const token = tokenAt(state, cell);
    const glow = highlights && legal.has(cell);
    const parts: string[] = [cell, token === null ? tileName(tile) : `${possessive(mode, token)} token`];
    if (glow) parts.push('legal take');
    if (cell === last) parts.push('last take');
    if (winning.has(cell)) parts.push(`winning ${shape!.by}`);
    return { cell, tile, token, edge: isEdgeCell(cell), legal: legal.has(cell), glow, last: cell === last, winning: winning.has(cell), label: parts.join(', ') };
  });
  return {
    cells,
    glowing: cells.filter((view) => view.glow).map((view) => view.cell),
    active: state.result ? null : state.toMove,
    acceptsTakes,
    winningShape: shape,
  };
}
