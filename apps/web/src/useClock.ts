import { useEffect, useRef, useState } from 'react';
import type { GameState, Player } from '@okiya/game';
import { outOfTimePlayer, runClock, startClock, timesLeft, type Clock, type ClockTimes } from './clock';

/** How often a running clock redraws and checks for the end of its time. */
export const CLOCK_TICK_MS = 200;

/**
 * Runs a timed game's clocks (null: an untimed game). Only the player to move has a running clock, and
 * none runs while `paused` (the menu is open) or once the game has ended; a take hands the time over.
 * When the running clock reaches zero, `onOutOfTime` hears that player once. `read` gives the times left
 * right now, for saving the game.
 */
export function useClock(start: ClockTimes | null, state: GameState, paused: boolean, onOutOfTime: (player: Player) => void) {
  const clock = useRef<Clock | null>(start ? startClock(start, null, Date.now()) : null);
  const [now, setNow] = useState(() => Date.now());
  const listener = useRef(onOutOfTime);
  listener.current = onOutOfTime;
  const running = clock.current && !state.result && !paused ? state.toMove : null;
  const takes = state.takes.length;

  useEffect(() => {
    // The turn or the pause changed: stop the clock that ran and start the one that runs now.
    if (!clock.current) return;
    const at = Date.now();
    clock.current = runClock(clock.current, running, at);
    setNow(at);
  }, [running, takes]);

  useEffect(() => {
    if (!clock.current || running === null) return;
    let reported = false;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      const out = clock.current ? outOfTimePlayer(clock.current, at) : null;
      if (out && !reported) {
        reported = true;
        listener.current(out);
      }
    };
    const timer = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [running, takes]);

  return {
    /** Each player's time left as drawn now, or null for an untimed game. */
    times: clock.current ? timesLeft(clock.current, now) : null,
    /** Whose clock runs, or null. */
    running: clock.current?.running ?? null,
    /** The times left at this moment, for the save. */
    read: (): ClockTimes | null => (clock.current ? timesLeft(clock.current, Date.now()) : null),
  };
}
