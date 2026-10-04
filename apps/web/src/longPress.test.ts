import { describe, expect, it } from 'vitest';
import { createLongPress, LONG_PRESS_MS } from './longPress';

/** Timers the test moves by hand. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout: ((run: () => void, ms: number) => {
      const id = next++;
      pending.set(id, { at: now + ms, run });
      return id;
    }) as unknown as typeof setTimeout,
    clearTimeout: ((id: number) => void pending.delete(id)) as unknown as typeof clearTimeout,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...pending]) {
        if (timer.at <= now) {
          pending.delete(id);
          timer.run();
        }
      }
    },
  };
}

describe('long press on a tile (PRD I1, E3)', () => {
  it('shows the name after 450 ms held and swallows the click that follows, once', () => {
    expect(LONG_PRESS_MS).toBe(450);
    const timers = fakeTimers();
    const shown: string[] = [];
    const press = createLongPress<string>((cell) => shown.push(cell), timers);
    press.start('B2');
    timers.advance(449);
    expect(shown).toEqual([]);
    timers.advance(1);
    expect(shown).toEqual(['B2']);
    press.cancel();
    expect(press.takeClick()).toBe(false);
    // The next tap is a normal tap again.
    press.start('B2');
    timers.advance(100);
    press.cancel();
    expect(press.takeClick()).toBe(true);
    expect(shown).toEqual(['B2']);
  });

  it('keeps a short press a tap: released, left or cancelled before 450 ms', () => {
    const timers = fakeTimers();
    const shown: string[] = [];
    const press = createLongPress<string>((cell) => shown.push(cell), timers);
    press.start('A1');
    timers.advance(300);
    press.cancel();
    timers.advance(1000);
    expect(shown).toEqual([]);
    expect(press.takeClick()).toBe(true);
  });

  it('forgets a long press whose click never came once the next press starts', () => {
    const timers = fakeTimers();
    const press = createLongPress<string>(() => {}, timers);
    press.start('C3');
    timers.advance(500);
    press.start('C4');
    timers.advance(50);
    press.cancel();
    expect(press.takeClick()).toBe(true);
  });
});
