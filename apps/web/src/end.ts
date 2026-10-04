import { ALL_CELLS, cellColumn, cellRow, tokenAt, type CellId, type GameState } from '@okiya/game';
import { tileName } from './text';

/**
 * The end of a game on the board (PRD U10): a short sequence of at most 700 ms in CSS, driven by these
 * marks on the cells. A line or square lifts its four tokens one after another while the other cells dim;
 * a blockade greys out the free tiles and the Match card says that no tile matches; a draw settles evenly.
 */
export type EndMark = 'lift' | 'dim' | 'grey' | 'settle';

export interface EndCell {
  readonly cell: CellId;
  readonly mark: EndMark | null;
  /** The place of a lifting token in the sequence, 0 to 3; null for any other cell. */
  readonly liftOrder: number | null;
}

export interface EndModel {
  readonly kind: 'shape' | 'blockade' | 'draw';
  /** Every cell in board order with its mark. */
  readonly cells: readonly EndCell[];
  /** The winning tokens in the order they lift: a line from end to end, a square round its loop. */
  readonly lifts: readonly CellId[];
  readonly dims: readonly CellId[];
  readonly greys: readonly CellId[];
  /** The Match card's text after a blockade: "No tile matches Desert–Star"; else null. */
  readonly matchText: string | null;
}

/** The order the four cells of a winning shape lift in, which the stroke follows too. */
export function liftOrder(by: 'line' | 'square', cells: readonly CellId[]): CellId[] {
  const sorted = [...cells].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(a) - cellColumn(b));
  // A square goes round: top left, top right, bottom right, bottom left.
  return by === 'square' ? [sorted[0]!, sorted[1]!, sorted[3]!, sorted[2]!] : sorted;
}

/** The end sequence of a finished game, or null while it runs. */
export function endModel(state: GameState): EndModel | null {
  const { result } = state;
  if (!result) return null;
  let kind: EndModel['kind'];
  let lifts: CellId[] = [];
  let mark: (cell: CellId) => EndMark | null;
  if (result.kind === 'draw') {
    kind = 'draw';
    mark = () => 'settle';
  } else if (result.by === 'blockade') {
    kind = 'blockade';
    mark = (cell) => (tokenAt(state, cell) === null ? 'grey' : null);
  } else {
    kind = 'shape';
    lifts = liftOrder(result.by, result.cells);
    const lifting = new Set(lifts);
    mark = (cell) => (lifting.has(cell) ? 'lift' : 'dim');
  }
  const cells = ALL_CELLS.map((cell): EndCell => {
    const order = lifts.indexOf(cell);
    return { cell, mark: mark(cell), liftOrder: order < 0 ? null : order };
  });
  const having = (wanted: EndMark) => cells.filter((view) => view.mark === wanted).map((view) => view.cell);
  return {
    kind,
    cells,
    lifts,
    dims: having('dim'),
    greys: having('grey'),
    matchText: kind === 'blockade' && state.lastTile ? `No tile matches ${tileName(state.lastTile)}` : null,
  };
}
