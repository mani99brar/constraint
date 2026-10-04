/**
 * Short, non-blocking notices (PRD U3): a refused take with its reason, and in a bot game the bot's
 * take. The end of the game is shown by the end screen and the seats, never by a toast.
 */
export type ToastKind = 'refusal' | 'take';

export interface ToastSpec {
  readonly kind: ToastKind;
  readonly text: string;
  /**
   * The one-line form a phone shows, chosen by the kind of notice, never by measuring text ("Bot took
   * D3", "Edge tiles only at the start"); the full text stays in the page for screen readers.
   */
  readonly short: string;
  /** Alerts are about something that went against the player. */
  readonly tone: 'info' | 'alert';
}

export function refusalToast(reason: string, short: string = reason): ToastSpec {
  return { kind: 'refusal', text: reason, short, tone: 'alert' };
}

/** The other side's take, for example "Bot took D3, Desert–Star", or "Bot took D3" on a phone. */
export function takeToast(text: string, short: string = text): ToastSpec {
  return { kind: 'take', text, short, tone: 'info' };
}

/** How long a toast stays, the fade at its end (under 400 ms, PRD U8) and how many show at once. */
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

const isImmediate = (spec: ToastSpec) => spec.kind === 'refusal';

/**
 * Adds toasts at the end of the queue. A new toast replaces an older one of its kind, which is out
 * of date; a refusal shows straight away even when other toasts fill the screen.
 */
export function enqueueToasts(queue: ToastQueue, specs: readonly ToastSpec[], now: number): ToastQueue {
  if (specs.length === 0) return queue;
  const kinds = new Set(specs.map((spec) => spec.kind));
  const items = queue.items.filter((item) => !kinds.has(item.kind));
  // A refusal answers the tap just made, so it shows at once, never behind waiting toasts.
  const added = specs.map((spec, index) => ({ ...spec, id: queue.nextId + index, shownAt: isImmediate(spec) ? now : null }));
  return tickToasts({ items: [...items, ...added], nextId: queue.nextId + specs.length }, now);
}

/** Drops every refusal: once the turn changes, the reason no longer applies (PRD U3). */
export function dropRefusals(queue: ToastQueue): ToastQueue {
  const items = queue.items.filter((item) => item.kind !== 'refusal');
  return items.length === queue.items.length ? queue : { ...queue, items };
}

/** What a new take does to the queue: refusals go when the turn changes, then its own toasts come. */
export function applyTakeToasts(queue: ToastQueue, change: { readonly turnChanged: boolean; readonly toasts: readonly ToastSpec[] }, now: number): ToastQueue {
  return enqueueToasts(change.turnChanged ? tickToasts(dropRefusals(queue), now) : queue, change.toasts, now);
}

/** The toasts on screen, oldest first, each marked while it fades out. */
export function visibleToasts(queue: ToastQueue, now: number): { readonly toast: QueuedToast; readonly leaving: boolean }[] {
  return queue.items
    .filter((item) => item.shownAt !== null)
    .map((toast) => ({ toast, leaving: now >= toast.shownAt! + TOAST_MS - FADE_MS }));
}

/**
 * The one toast a phone shows in the gap under the board (PRD U3, U6): a refusal outranks a take, and the
 * newest of a kind replaces an older one. Null when no toast is up.
 */
export function phoneToast(visible: readonly { readonly toast: QueuedToast }[]): number | null {
  const newest = (items: readonly { readonly toast: QueuedToast }[]) => (items.length === 0 ? null : items.reduce((a, b) => (b.toast.id > a.toast.id ? b : a)).toast.id);
  return newest(visible.filter(({ toast }) => toast.kind === 'refusal')) ?? newest(visible);
}

/** The next moment the queue changes on its own (a fade starts or a toast leaves), or null. */
export function nextToastChange(queue: ToastQueue, now: number): number | null {
  const times = queue.items.flatMap((item) => (item.shownAt === null ? [] : [item.shownAt + TOAST_MS - FADE_MS, item.shownAt + TOAST_MS]));
  const future = times.filter((time) => time > now);
  return future.length > 0 ? Math.min(...future) : null;
}
