// Components and coordinates (spec §3): rows A–D top to bottom, columns 1–4 left to right.

export const TERRAINS = ['Forest', 'Water', 'Mountain', 'Desert'] as const;
export type Terrain = (typeof TERRAINS)[number];

export const SYMBOLS = ['Sun', 'Moon', 'Star', 'Wave'] as const;
export type TileSymbol = (typeof SYMBOLS)[number];

export interface Tile {
  readonly terrain: Terrain;
  readonly symbol: TileSymbol;
}

/** The matching constraint is stored as a pair of values, never as a pointer to a cell (spec §6). */
export type Constraint = Tile;

export const ROWS = ['A', 'B', 'C', 'D'] as const;
export type Row = (typeof ROWS)[number];
export const COLUMNS = [1, 2, 3, 4] as const;
export type Column = (typeof COLUMNS)[number];
export type CellId = `${Row}${Column}`;

/** All 16 cells in row-major order. */
export const ALL_CELLS: readonly CellId[] = ROWS.flatMap((row) => COLUMNS.map((column) => `${row}${column}` as CellId));

/** Terrain tile of every cell. */
export type Board = Readonly<Record<CellId, Tile>>;

export function isCellId(value: string): value is CellId {
  return (ALL_CELLS as readonly string[]).includes(value);
}

export function cellRow(cell: CellId): number {
  return ROWS.indexOf(cell[0] as Row);
}

export function cellColumn(cell: CellId): number {
  return Number(cell[1]) - 1;
}

/** The cell at zero-based row and column, or null when out of bounds (no wrapping). */
export function cellAt(row: number, column: number): CellId | null {
  const r = ROWS[row];
  const c = COLUMNS[column];
  return r === undefined || c === undefined ? null : `${r}${c}`;
}

/** Orthogonal neighbours, never diagonal (spec §3). */
export function adjacentCells(cell: CellId): CellId[] {
  const row = cellRow(cell);
  const column = cellColumn(cell);
  return [cellAt(row - 1, column), cellAt(row + 1, column), cellAt(row, column - 1), cellAt(row, column + 1)].filter(
    (c): c is CellId => c !== null,
  );
}

export function areAdjacent(a: CellId, b: CellId): boolean {
  return Math.abs(cellRow(a) - cellRow(b)) + Math.abs(cellColumn(a) - cellColumn(b)) === 1;
}

/** Outside-edge cells, where the opening deployment goes (spec §5 step 7). */
export function isEdgeCell(cell: CellId): boolean {
  const row = cellRow(cell);
  const column = cellColumn(cell);
  return row === 0 || row === ROWS.length - 1 || column === 0 || column === COLUMNS.length - 1;
}

/** A tile matches when it shares the terrain or the symbol of the constraint (spec §6). */
export function tileMatches(tile: Tile, constraint: Constraint): boolean {
  return tile.terrain === constraint.terrain || tile.symbol === constraint.symbol;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.terrain === b.terrain && a.symbol === b.symbol;
}

/** The nine 2×2 squares of the board, each as its four cells (spec §10). */
export const SQUARES: readonly (readonly CellId[])[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2].map((column) => [
    cellAt(row, column)!,
    cellAt(row, column + 1)!,
    cellAt(row + 1, column)!,
    cellAt(row + 1, column + 1)!,
  ]),
);
