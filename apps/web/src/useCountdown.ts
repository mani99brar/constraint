import { useCallback, useEffect, useState } from 'react';
import { COUNTDOWN_FROM, COUNTDOWN_STEP_MS } from './countdown';

/**
 * The countdown before a new game: counts down from 3 every 600 ms while `active`, then ends; 0 means
 * the game has started. `skip` ends it at once.
 */
export function useCountdown(active: boolean) {
  const [count, setCount] = useState(active ? COUNTDOWN_FROM : 0);

  useEffect(() => {
    if (count <= 0) return;
    const timer = setTimeout(() => setCount((current) => Math.max(0, current - 1)), COUNTDOWN_STEP_MS);
    return () => clearTimeout(timer);
  }, [count]);

  const skip = useCallback(() => setCount(0), []);
  return { count, counting: count > 0, skip };
}
