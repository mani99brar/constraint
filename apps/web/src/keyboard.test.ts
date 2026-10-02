import { describe, expect, it } from 'vitest';
import { ALL_CELLS, type CellId } from '@okiya/game';
import { boardKey, isActivationKey, nextCell, tabStop } from './keyboard';

describe('keyboard focus on the board (PRD U7)', () => {
  it('moves focus one cell per arrow key', () => {
    expect(nextCell('B2', 'ArrowUp')).toBe('A2');
    expect(nextCell('B2', 'ArrowDown')).toBe('C2');
    expect(nextCell('B2', 'ArrowLeft')).toBe('B1');
    expect(nextCell('B2', 'ArrowRight')).toBe('B3');
  });

  it('never leaves the 4×4 board', () => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (const cell of ALL_CELLS) for (const key of arrows) expect(ALL_CELLS).toContain(nextCell(cell, key));
    expect(nextCell('A1', 'ArrowUp')).toBe('A1');
    expect(nextCell('A1', 'ArrowLeft')).toBe('A1');
    expect(nextCell('D4', 'ArrowDown')).toBe('D4');
    expect(nextCell('D4', 'ArrowRight')).toBe('D4');
    let cell: CellId = 'C3';
    for (let i = 0; i < 10; i += 1) cell = nextCell(cell, 'ArrowRight');
    expect(cell).toBe('C4');
  });

  it('reaches every cell from A1', () => {
    const seen = new Set<CellId>(['A1']);
    const queue: CellId[] = ['A1'];
    while (queue.length > 0) {
      const cell = queue.shift()!;
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        const next = nextCell(cell, key);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(16);
  });

  it('selects the focused cell with Enter or Space, and leaves other keys to the browser', () => {
    expect(boardKey('C2', 'Enter')).toEqual({ kind: 'activate', cell: 'C2' });
    expect(boardKey('C2', ' ')).toEqual({ kind: 'activate', cell: 'C2' });
    expect(boardKey('C2', 'ArrowLeft')).toEqual({ kind: 'focus', cell: 'C1' });
    expect(boardKey('C2', 'Home')).toEqual({ kind: 'focus', cell: 'A1' });
    expect(boardKey('C2', 'End')).toEqual({ kind: 'focus', cell: 'D4' });
    expect(boardKey('C2', 'Tab')).toBeNull();
    expect(boardKey('C2', 'a')).toBeNull();
  });

  it('treats Enter and Space as taking the focused tile', () => {
    expect(isActivationKey('Enter')).toBe(true);
    expect(isActivationKey(' ')).toBe(true);
    expect(isActivationKey('Escape')).toBe(false);
  });

  it('puts the board’s Tab stop on the focused cell, else the first highlighted one, else A1', () => {
    expect(tabStop('C3', ['B1', 'D4'])).toBe('C3');
    expect(tabStop(null, ['D4', 'B1'])).toBe('B1');
    expect(tabStop(null, [])).toBe('A1');
  });
});
