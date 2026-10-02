/** Focus handling of a modal dialog (PRD U7, E2), as pure functions over anything focusable. */

export interface Focusable {
  focus(): void;
  readonly isConnected?: boolean;
}

/**
 * Where Tab should move focus inside a dialog so it never leaves it: from the last element to the
 * first, from the first back to the last with Shift, and into the dialog when focus is outside.
 * Null means the browser's own Tab order already stays inside.
 */
export function wrapFocus<T>(focusables: readonly T[], active: T | null, backwards: boolean): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const index = active === null ? -1 : focusables.indexOf(active);
  if (index === -1) return backwards ? last : first;
  if (!backwards && index === focusables.length - 1) return first;
  if (backwards && index === 0) return last;
  return null;
}

/** Returns focus to the element that opened a dialog, when it is still on the page. */
export function restoreFocus(opener: Focusable | null): boolean {
  if (!opener || opener.isConnected === false) return false;
  opener.focus();
  return true;
}

/** The selector of every element Tab can reach. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
