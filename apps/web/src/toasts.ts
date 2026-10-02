import type { PlayerEvent, PlayerId } from '@okiya/rules';
import { describeEvent, orderEvents } from './events';
import { fighterLabel, sideName } from './text';

/**
 * Short notices for what the board cannot show by itself (PRD T1): a trap triggered, a charge
 * lost, a lock applied, the bot hiding a trap, the player's own Trap Checker result and a refused
 * move with its reason. Everything else an action does is visible on the board.
 */
export type ToastKind = 'trap-triggered' | 'charge-lost' | 'lock-applied' | 'trap-hidden' | 'inspection' | 'refusal' | 'hint';

export interface ToastSpec {
  readonly kind: ToastKind;
  readonly text: string;
  /** Alerts are about something that went against the player. */
  readonly tone: 'info' | 'alert';
}

function eventToast(event: PlayerEvent, human: PlayerId): ToastSpec | null {
  const against = (fighter: string) => (fighter.startsWith(`${human}:`) ? 'alert' : 'info');
  switch (event.kind) {
    case 'trap-triggered':
      return { kind: 'trap-triggered', text: describeEvent(event, human), tone: against(event.fighter) };
    case 'charge-lost':
      return { kind: 'charge-lost', text: describeEvent(event, human), tone: against(event.fighter) };
    case 'lock-applied':
      return { kind: 'lock-applied', text: `${fighterLabel(event.fighter, human)} is locked and misses its next turn.`, tone: against(event.fighter) };
    case 'trap-placed':
      // Only the other side's placement needs a notice, and the projected event never has its cell.
      return event.owner === human ? null : { kind: 'trap-hidden', text: `${sideName(event.owner, human)} hid a trap somewhere.`, tone: 'info' };
    case 'traps-inspected':
      // The result is null unless the viewer inspected (spec §4), so only the player's own shows.
      return event.inspector === human && event.removed !== null ? { kind: 'inspection', text: describeEvent(event, human), tone: 'info' } : null;
    default:
      return null;
  }
}

/** The toasts of one action's projected events, in spec §11 order (PRD R5). */
export function eventToasts(events: readonly PlayerEvent[], human: PlayerId): ToastSpec[] {
  return orderEvents(events).flatMap((event) => eventToast(event, human) ?? []);
}

export function refusalToast(reason: string): ToastSpec {
  return { kind: 'refusal', text: reason, tone: 'alert' };
}

export function hintToast(message: string): ToastSpec {
  return { kind: 'hint', text: message, tone: 'info' };
}

/** How long a toast stays, the fade at its end (under 400 ms, PRD U6) and how many show at once. */
export const TOAST_MS = 4000;
export const FADE_MS = 250;
export const MAX_VISIBLE = 3;

export interface QueuedToast extends ToastSpec {
  readonly id: number;
  /** When it appeared; null while it waits for room. */
  readonly shownAt: number | null;
}

export interface ToastQueue {
  readonly items: readonly QueuedToast[];
  readonly nextId: number;
}

export const EMPTY_TOASTS: ToastQueue = { items: [], nextId: 1 };

/** Removes the toasts whose time is up and shows waiting ones, in order, while there is room. */
export function tickToasts(queue: ToastQueue, now: number): ToastQueue {
  const kept = queue.items.filter((item) => item.shownAt === null || now < item.shownAt + TOAST_MS);
  let shown = kept.filter((item) => item.shownAt !== null).length;
  const items = kept.map((item) => {
    if (item.shownAt !== null || shown >= MAX_VISIBLE) return item;
    shown += 1;
    return { ...item, shownAt: now };
  });
  const changed = items.length !== queue.items.length || items.some((item, index) => item !== queue.items[index]);
  return changed ? { ...queue, items } : queue;
}

const isImmediate = (spec: ToastSpec) => spec.kind === 'refusal' || spec.kind === 'hint';

/**
 * Adds toasts at the end of the queue; a new refusal replaces an older one, which is out of date,
 * and shows straight away even when the event toasts fill the screen.
 */
export function enqueueToasts(queue: ToastQueue, specs: readonly ToastSpec[], now: number): ToastQueue {
  if (specs.length === 0) return queue;
  const replacesRefusal = specs.some(isImmediate);
  const items = queue.items.filter((item) => !(replacesRefusal && isImmediate(item)));
  // A refusal answers the tap just made, so it shows at once, never behind waiting event toasts.
  const added = specs.map((spec, index) => ({ ...spec, id: queue.nextId + index, shownAt: isImmediate(spec) ? now : null }));
  return tickToasts({ items: [...items, ...added], nextId: queue.nextId + specs.length }, now);
}

/** The toasts on screen, oldest first, each marked while it fades out. */
export function visibleToasts(queue: ToastQueue, now: number): { readonly toast: QueuedToast; readonly leaving: boolean }[] {
  return queue.items
    .filter((item) => item.shownAt !== null)
    .map((toast) => ({ toast, leaving: now >= toast.shownAt! + TOAST_MS - FADE_MS }));
}

/** The next moment the queue changes on its own (a fade starts or a toast leaves), or null. */
export function nextToastChange(queue: ToastQueue, now: number): number | null {
  const times = queue.items.flatMap((item) => (item.shownAt === null ? [] : [item.shownAt + TOAST_MS - FADE_MS, item.shownAt + TOAST_MS]));
  const future = times.filter((time) => time > now);
  return future.length > 0 ? Math.min(...future) : null;
}
