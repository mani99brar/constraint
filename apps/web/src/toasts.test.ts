import { describe, expect, it } from 'vitest';
import { projectEvents, type PlayerEvent, type ResolutionEvent } from '@okiya/rules';
import {
  EMPTY_TOASTS,
  enqueueToasts,
  eventToasts,
  FADE_MS,
  MAX_VISIBLE,
  nextToastChange,
  refusalToast,
  tickToasts,
  TOAST_MS,
  visibleToasts,
  type ToastSpec,
} from './toasts';

// Hand-built: a swap that enters two traps at once (spec §8.3), listed out of order.
const SWAP_INTO_TRAPS: readonly PlayerEvent[] = [
  { kind: 'constraint-set', constraint: { terrain: 'Water', symbol: 'Moon' } },
  { kind: 'lock-applied', fighter: 'B:Swapper', expiresAfterTurn: 8 },
  { kind: 'charge-lost', fighter: 'A:Pusher' },
  { kind: 'trap-triggered', trapId: 'A-setup-1', owner: 'A', cell: 'B3', fighter: 'B:Swapper' },
  { kind: 'trap-triggered', trapId: 'B-setup-2', owner: 'B', cell: 'B2', fighter: 'A:Pusher' },
  { kind: 'fighter-entered', fighter: 'B:Swapper', from: 'B2', to: 'B3', entry: 'swap' },
  { kind: 'fighter-entered', fighter: 'A:Pusher', from: 'B3', to: 'B2', entry: 'swap' },
  { kind: 'charge-spent', fighter: 'B:Swapper' },
];

describe('event toasts (PRD T1, spec §11)', () => {
  it('turns projected events into toasts in spec §11 order: each trap trigger, then its charge loss or lock', () => {
    expect(eventToasts(SWAP_INTO_TRAPS, 'A').map((toast) => [toast.kind, toast.text, toast.tone])).toEqual([
      ['trap-triggered', "Bot's Swapper triggered your trap at B3.", 'info'],
      ['lock-applied', "Bot's Swapper is locked and misses its next turn.", 'info'],
      ['trap-triggered', "Your Pusher triggered the bot's trap at B2.", 'alert'],
      ['charge-lost', 'Your Pusher lost its charge to the trap.', 'alert'],
    ]);
  });

  it('shows no toast for what the board shows by itself', () => {
    const plain: PlayerEvent[] = [
      { kind: 'fighter-entered', fighter: 'A:Pusher', from: null, to: 'A1', entry: 'deploy' },
      { kind: 'constraint-set', constraint: { terrain: 'Forest', symbol: 'Sun' } },
      { kind: 'charge-spent', fighter: 'A:Pusher' },
      { kind: 'match-ended', result: { kind: 'win', winner: 'A', reason: 'objective' } },
    ];
    expect(eventToasts(plain, 'A')).toEqual([]);
  });

  it('shows a bot Trapper placement without any cell', () => {
    const placed: ResolutionEvent[] = [
      { kind: 'charge-spent', fighter: 'B:Trapper' },
      { kind: 'trap-placed', owner: 'B', trapId: 'B-trap-5', cell: 'C2' },
      { kind: 'constraint-set', constraint: { terrain: 'Forest', symbol: 'Sun' } },
    ];
    const toasts = eventToasts(projectEvents(placed, 'A'), 'A');
    expect(toasts).toEqual([{ kind: 'trap-hidden', text: 'Bot hid a trap somewhere.', tone: 'info' }]);
    for (const toast of toasts) expect(toast.text).not.toMatch(/[A-D][1-4]/);
    // The player's own placement is marked on its cell instead.
    expect(eventToasts(projectEvents([{ kind: 'trap-placed', owner: 'A', trapId: 'A-trap-5', cell: 'C2' }], 'A'), 'A')).toEqual([]);
  });

  it('shows the player’s own Trap Checker result, and never the bot’s', () => {
    const own: ResolutionEvent[] = [{ kind: 'traps-inspected', inspector: 'A', actor: 'A:TrapChecker', cell: 'C2', removed: 1 }];
    expect(eventToasts(projectEvents(own, 'A'), 'A')).toEqual([
      { kind: 'inspection', text: 'Your Trap Checker inspected C2: removed 1 enemy trap.', tone: 'info' },
    ]);
    const bots: ResolutionEvent[] = [{ kind: 'traps-inspected', inspector: 'B', actor: 'B:TrapChecker', cell: 'A2', removed: 1 }];
    expect(eventToasts(projectEvents(bots, 'A'), 'A')).toEqual([]);
  });
});

describe('toast queue', () => {
  const spec = (text: string): ToastSpec => ({ kind: 'trap-triggered', text, tone: 'info' });

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

  it('fades in under 400 ms (PRD U6)', () => {
    expect(FADE_MS).toBeLessThan(400);
  });

  it('shows a refusal at once even when event toasts fill the screen, and replaces an older refusal', () => {
    let queue = enqueueToasts(EMPTY_TOASTS, ['a', 'b', 'c', 'd'].map(spec), 0);
    queue = enqueueToasts(queue, [refusalToast('B2 is occupied.')], 100);
    expect(visibleToasts(queue, 100).map(({ toast }) => toast.text)).toEqual(['a', 'b', 'c', 'B2 is occupied.']);
    queue = enqueueToasts(queue, [refusalToast('C3 is occupied.')], 200);
    expect(visibleToasts(queue, 200).map(({ toast }) => toast.text)).toEqual(['a', 'b', 'c', 'C3 is occupied.']);
    // The waiting event toast still comes, after the others leave.
    queue = tickToasts(queue, TOAST_MS + 200);
    expect(visibleToasts(queue, TOAST_MS + 200).map(({ toast }) => toast.text)).toEqual(['d']);
  });
});
