import { describe, expect, it } from 'vitest';
import {
  EMPTY_TOASTS,
  endToast,
  enqueueToasts,
  FADE_MS,
  MAX_VISIBLE,
  nextToastChange,
  refusalToast,
  tickToasts,
  TOAST_MS,
  visibleToasts,
  type ToastSpec,
} from './toasts';

describe('toasts (PRD U3)', () => {
  it('turns a refusal into an alert and the end of the game into a notice, an alert only for a loss', () => {
    expect(refusalToast('Desert–Moon matches neither Forest nor Star')).toEqual({
      kind: 'refusal',
      text: 'Desert–Moon matches neither Forest nor Star',
      tone: 'alert',
    });
    expect(endToast('You win with a line', 'win')).toEqual({ kind: 'end', text: 'You win with a line', tone: 'info' });
    expect(endToast('The bot wins by blockade', 'loss').tone).toBe('alert');
    expect(endToast('Draw: the board is full', 'draw').tone).toBe('info');
  });
});

describe('toast queue', () => {
  const spec = (text: string): ToastSpec => ({ kind: 'end', text, tone: 'info' });

  it('shows toasts in order, at most a few at once, and lets the next in when one leaves', () => {
    let queue = enqueueToasts(EMPTY_TOASTS, ['a', 'b', 'c', 'd'].map(spec), 0);
    expect(visibleToasts(queue, 0).map(({ toast }) => toast.text)).toEqual(['a', 'b', 'c']);
    expect(MAX_VISIBLE).toBe(3);
    expect(nextToastChange(queue, 0)).toBe(TOAST_MS - FADE_MS);
    expect(visibleToasts(queue, TOAST_MS - FADE_MS).every(({ leaving }) => leaving)).toBe(true);
    queue = tickToasts(queue, TOAST_MS);
    expect(visibleToasts(queue, TOAST_MS).map(({ toast }) => toast.text)).toEqual(['d']);
    queue = tickToasts(queue, 2 * TOAST_MS);
    expect(queue.items).toEqual([]);
    expect(nextToastChange(queue, 2 * TOAST_MS)).toBeNull();
  });

  it('fades in under 400 ms (PRD U8)', () => {
    expect(FADE_MS).toBeLessThan(400);
  });

  it('shows a refusal at once even when other toasts fill the screen, and replaces an older refusal', () => {
    let queue = enqueueToasts(EMPTY_TOASTS, ['a', 'b', 'c', 'd'].map(spec), 0);
    queue = enqueueToasts(queue, [refusalToast('Forest–Sun at B2 was already taken; a token stands there now.')], 100);
    expect(visibleToasts(queue, 100).map(({ toast }) => toast.text)).toEqual(['a', 'b', 'c', 'Forest–Sun at B2 was already taken; a token stands there now.']);
    queue = enqueueToasts(queue, [refusalToast('Desert–Moon matches neither Forest nor Star')], 200);
    expect(visibleToasts(queue, 200).map(({ toast }) => toast.text)).toEqual(['a', 'b', 'c', 'Desert–Moon matches neither Forest nor Star']);
    // The waiting toast still comes, after the others leave.
    queue = tickToasts(queue, TOAST_MS + 200);
    expect(visibleToasts(queue, TOAST_MS + 200).map(({ toast }) => toast.text)).toEqual(['d']);
  });
});
