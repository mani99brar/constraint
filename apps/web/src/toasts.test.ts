import { describe, expect, it } from 'vitest';
import {
  applyTakeToasts,
  dropRefusals,
  EMPTY_TOASTS,
  enqueueToasts,
  FADE_MS,
  MAX_VISIBLE,
  nextToastChange,
  phoneToast,
  refusalToast,
  takeToast,
  tickToasts,
  TOAST_MS,
  visibleToasts,
  type ToastSpec,
} from './toasts';

describe('toasts (PRD U3)', () => {
  it('turns a refusal into an alert and the bot’s take into a notice', () => {
    expect(refusalToast('Desert–Moon matches neither Forest nor Star', 'Desert–Moon doesn’t match Forest–Star')).toEqual({
      kind: 'refusal',
      text: 'Desert–Moon matches neither Forest nor Star',
      short: 'Desert–Moon doesn’t match Forest–Star',
      tone: 'alert',
    });
    expect(takeToast('Bot took D3, Desert–Star', 'Bot took D3')).toEqual({ kind: 'take', text: 'Bot took D3, Desert–Star', short: 'Bot took D3', tone: 'info' });
    // Without a short form, the phone shows the text itself.
    expect(takeToast('Bot took D3, Desert–Star').short).toBe('Bot took D3, Desert–Star');
  });

  it('drops a refusal when the turn changes, and keeps it while the turn stays', () => {
    const refused = enqueueToasts(EMPTY_TOASTS, [refusalToast('Desert–Moon matches neither Forest nor Star')], 0);
    expect(applyTakeToasts(refused, { turnChanged: false, toasts: [] }, 10)).toBe(refused);
    const changed = applyTakeToasts(refused, { turnChanged: true, toasts: [] }, 10);
    expect(visibleToasts(changed, 10)).toEqual([]);
    const botTook = applyTakeToasts(refused, { turnChanged: true, toasts: [takeToast('Bot took D3, Desert–Star')] }, 10);
    expect(visibleToasts(botTook, 10).map(({ toast }) => [toast.kind, toast.text])).toEqual([['take', 'Bot took D3, Desert–Star']]);
    expect(dropRefusals(botTook)).toBe(botTook);
  });

  it('keeps only the newest take toast', () => {
    let queue = enqueueToasts(EMPTY_TOASTS, [takeToast('Bot took D3, Desert–Star')], 0);
    queue = enqueueToasts(queue, [takeToast('Bot took A1, Forest–Sun')], 50);
    expect(visibleToasts(queue, 50).map(({ toast }) => toast.text)).toEqual(['Bot took A1, Forest–Sun']);
  });
});

describe('the phone’s one toast (PRD U3, U6)', () => {
  it('shows one toast at a time: a refusal outranks a take, and the newest replaces an older one', () => {
    expect(phoneToast([])).toBeNull();
    const took = enqueueToasts(EMPTY_TOASTS, [takeToast('Bot took D3, Desert–Star', 'Bot took D3')], 0);
    const takeId = visibleToasts(took, 0)[0]!.toast.id;
    expect(phoneToast(visibleToasts(took, 0))).toBe(takeId);
    const refused = enqueueToasts(took, [refusalToast('Water–Sun is not an edge tile; the first take must come from the edge.', 'Edge tiles only at the start')], 10);
    const shown = visibleToasts(refused, 10);
    expect(shown).toHaveLength(2);
    const refusalId = shown.find(({ toast }) => toast.kind === 'refusal')!.toast.id;
    expect(phoneToast(shown)).toBe(refusalId);
    // A newer take never hides the refusal; once the refusal goes, the take shows again.
    const newer = enqueueToasts(refused, [takeToast('Bot took A1, Forest–Sun', 'Bot took A1')], 20);
    expect(phoneToast(visibleToasts(newer, 20))).toBe(refusalId);
    const cleared = dropRefusals(newer);
    expect(visibleToasts(cleared, 20).find(({ toast }) => toast.id === phoneToast(visibleToasts(cleared, 20)))!.toast.short).toBe('Bot took A1');
  });
});

describe('toast queue', () => {
  // Distinct kinds would replace one another, so the queue's own rules are tested with toasts built by hand.
  const spec = (text: string): ToastSpec => ({ kind: text as 'take', text, short: text, tone: 'info' });

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
