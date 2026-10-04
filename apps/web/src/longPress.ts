/**
 * A long press on a tile (PRD I1, E3): a pointer held for `LONG_PRESS_MS` or more shows the tile's name
 * and does not take it; the click that follows the release is swallowed. A shorter press is a normal tap.
 */
export const LONG_PRESS_MS = 450;

type Timers = { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };

export interface LongPress<T> {
  /** A pointer went down on `target`: the long press starts counting. */
  start(target: T): void;
  /** The pointer went up, left or was cancelled: a press not yet long stays a tap. */
  cancel(): void;
  /** Whether the click that follows a release takes the tile: false once after a long press. */
  takeClick(): boolean;
}

export function createLongPress<T>(onLong: (target: T) => void, timers: Timers = globalThis): LongPress<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  const cancel = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  return {
    start(target) {
      cancel();
      fired = false;
      timer = timers.setTimeout(() => {
        timer = null;
        fired = true;
        onLong(target);
      }, LONG_PRESS_MS);
    },
    cancel,
    takeClick() {
      if (!fired) return true;
      fired = false;
      return false;
    },
  };
}
