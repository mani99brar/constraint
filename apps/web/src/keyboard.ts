import { ALL_CELLS, cellAt, cellColumn, cellRow, type CellId } from '@okiya/rules';

const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** Enter and Space select the focused cell or fighter (PRD U3). */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

/** The cell an arrow key moves focus to; at the edge focus stays, so it never leaves the board. */
export function nextCell(cell: CellId, key: string): CellId {
  const step = STEPS[key];
  if (!step) return cell;
  return cellAt(cellRow(cell) + step[0], cellColumn(cell) + step[1]) ?? cell;
}

export type BoardKey = { readonly kind: 'focus'; readonly cell: CellId } | { readonly kind: 'activate'; readonly cell: CellId } | null;

/** What a key pressed on a focused board cell does; null leaves it to the browser (Tab, for example). */
export function boardKey(cell: CellId, key: string): BoardKey {
  if (key in STEPS) return { kind: 'focus', cell: nextCell(cell, key) };
  if (key === 'Home') return { kind: 'focus', cell: ALL_CELLS[0]! };
  if (key === 'End') return { kind: 'focus', cell: ALL_CELLS[ALL_CELLS.length - 1]! };
  if (isActivationKey(key)) return { kind: 'activate', cell };
  return null;
}

/**
 * The board's single Tab stop (roving tabindex): the cell last focused, else the first
 * highlighted cell, else A1, so Tab lands where the selected fighter can act.
 */
export function tabStop(focused: CellId | null, highlighted: Iterable<CellId>): CellId {
  if (focused) return focused;
  const set = new Set(highlighted);
  return ALL_CELLS.find((cell) => set.has(cell)) ?? ALL_CELLS[0]!;
}
