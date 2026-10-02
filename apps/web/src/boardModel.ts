import { ALL_CELLS, isEdgeCell, legalTakes, tileAt, tokenAt, type CellId, type GameState, type Player, type Tile } from '@okiya/game';
import { tileName } from './text';

/** Everything one cell of the board shows (PRD U1, I1, I2, R4). */
export interface CellView {
  readonly cell: CellId;
  /** The tile laid here at setup; shown only while `token` is null. */
  readonly tile: Tile;
  /** The taker's token, shown instead of the tile once it is taken. */
  readonly token: Player | null;
  readonly owner: 'you' | 'bot' | null;
  readonly edge: boolean;
  /** A legal take for the human right now, whether or not it glows. */
  readonly legal: boolean;
  /** Glows: a legal take with highlights on. */
  readonly glow: boolean;
  /** The latest take, marked until the next one. */
  readonly last: boolean;
  /** One of the winning shape's four cells, once the game has ended. */
  readonly winning: boolean;
  /** The accessible name, for example "B3, Water–Moon, legal take" or "B3, your token". */
  readonly label: string;
}

export interface BoardModel {
  readonly cells: readonly CellView[];
  /** The glowing cells, in board order: `legalTakes` on the human's turn with highlights on, else none. */
  readonly glowing: readonly CellId[];
  /** Whether a tap may take a tile: the human's turn of a running game. */
  readonly acceptsTakes: boolean;
}

export interface BoardOptions {
  readonly human: Player;
  readonly highlights: boolean;
}

function winningCells(state: GameState): ReadonlySet<CellId> {
  const { result } = state;
  return new Set(result?.kind === 'win' && result.by !== 'blockade' ? result.cells : []);
}

export function boardModel(state: GameState, { human, highlights }: BoardOptions): BoardModel {
  const acceptsTakes = !state.result && state.toMove === human;
  const legal = new Set(acceptsTakes ? legalTakes(state) : []);
  const last = state.takes[state.takes.length - 1] ?? null;
  const winning = winningCells(state);
  const shape = state.result?.kind === 'win' && state.result.by !== 'blockade' ? state.result.by : null;
  const cells = ALL_CELLS.map((cell): CellView => {
    const tile = tileAt(state, cell);
    const token = tokenAt(state, cell);
    const owner = token === null ? null : token === human ? 'you' : 'bot';
    const glow = highlights && legal.has(cell);
    const parts: string[] = [cell, owner === null ? tileName(tile) : owner === 'you' ? 'your token' : "bot's token"];
    if (glow) parts.push('legal take');
    if (cell === last) parts.push('last take');
    if (winning.has(cell)) parts.push(`winning ${shape}`);
    return { cell, tile, token, owner, edge: isEdgeCell(cell), legal: legal.has(cell), glow, last: cell === last, winning: winning.has(cell), label: parts.join(', ') };
  });
  return { cells, glowing: cells.filter((view) => view.glow).map((view) => view.cell), acceptsTakes };
}
