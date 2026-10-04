import { useCallback, useEffect, useState } from 'react';
import { applyTakeToasts, EMPTY_TOASTS, enqueueToasts, nextToastChange, tickToasts, visibleToasts, type ToastSpec } from './toasts';

/** The toast queue on a clock: toasts show in order, fade and leave on their own, never blocking input. */
export function useToasts() {
  const [queue, setQueue] = useState(EMPTY_TOASTS);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const at = nextToastChange(queue, now);
    if (at === null) return;
    const timer = setTimeout(() => {
      const time = Date.now();
      setNow(time);
      setQueue((current) => tickToasts(current, time));
    }, Math.max(0, at - now));
    return () => clearTimeout(timer);
  }, [queue, now]);

  const push = useCallback((specs: readonly ToastSpec[]) => {
    if (specs.length === 0) return;
    const time = Date.now();
    setNow(time);
    setQueue((current) => enqueueToasts(current, specs, time));
  }, []);

  /** A new take: refusals clear when the turn changes, then the take's own toasts show. */
  const afterTake = useCallback((change: { readonly turnChanged: boolean; readonly toasts: readonly ToastSpec[] }) => {
    if (!change.turnChanged && change.toasts.length === 0) return;
    const time = Date.now();
    setNow(time);
    setQueue((current) => applyTakeToasts(current, change, time));
  }, []);

  return { toasts: visibleToasts(queue, now), push, afterTake };
}
