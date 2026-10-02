// Components (spec §1): a 4×4 board, rows A–D top to bottom, columns 1–4 left to right, and 16 tiles.

export const TERRAINS = ['Forest', 'Water', 'Mountain', 'Desert'] as const;
export type Terrain = (typeof TERRAINS)[number];

export const SYMBOLS = ['Sun', 'Moon', 'Star', 'Wave'] as const;
export type TileSymbol = (typeof SYMBOLS)[number];

export interface Tile {
  readonly terrain: Terrain;
  readonly symbol: TileSymbol;
}

/** The 16 tiles: exactly one for every terrain/symbol pair. */
export const TILES: readonly Tile[] = TERRAINS.flatMap((terrain) => SYMBOLS.map((symbol) => ({ terrain, symbol })));

/** Two tiles match when they share their terrain, their symbol or both (spec §1). */
export function tilesMatch(a: Tile, b: Tile): boolean {
  return a.terrain === b.terrain || a.symbol === b.symbol;
}

export const ROWS = ['A', 'B', 'C', 'D'] as const;
export type Row = (typeof ROWS)[number];
export const COLUMNS = [1, 2, 3, 4] as const;
export type Column = (typeof COLUMNS)[number];
export type CellId = `${Row}${Column}`;

/** All 16 cells in row-major order; a cell's position in this list is its index in the state's arrays. */
export const ALL_CELLS: readonly CellId[] = ROWS.flatMap((row) => COLUMNS.map((column) => `${row}${column}` as CellId));

export function isCellId(value: unknown): value is CellId {
  return typeof value === 'string' && (ALL_CELLS as readonly string[]).includes(value);
}

export function cellIndex(cell: CellId): number {
  return ALL_CELLS.indexOf(cell);
}

export function cellRow(cell: CellId): number {
  return ROWS.indexOf(cell[0] as Row);
}

export function cellColumn(cell: CellId): number {
  return Number(cell[1]) - 1;
}

/** The 12 cells of the outer ring (spec §1), where the opening take must be. */
export const EDGE_CELLS: readonly CellId[] = ALL_CELLS.filter((cell) => {
  const row = cellRow(cell);
  const column = cellColumn(cell);
  return row === 0 || row === 3 || column === 0 || column === 3;
});

export function isEdgeCell(cell: CellId): boolean {
  return EDGE_CELLS.includes(cell);
}

const at = (row: number, column: number): CellId => ALL_CELLS[row * 4 + column]!;
const range = [0, 1, 2, 3] as const;

/** The ten lines (spec §4): four rows, four columns and the two long diagonals. */
export const LINES: readonly (readonly CellId[])[] = [
  ...range.map((row) => range.map((column) => at(row, column))),
  ...range.map((column) => range.map((row) => at(row, column))),
  range.map((i) => at(i, i)),
  range.map((i) => at(i, 3 - i)),
];

/** The nine 2×2 squares (spec §4). */
export const SQUARES: readonly (readonly CellId[])[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2].map((column) => [at(row, column), at(row, column + 1), at(row + 1, column), at(row + 1, column + 1)]),
);
