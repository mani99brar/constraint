import type { SoundEffect } from './sound';

/**
 * Haptic feedback for the same moments the sound effects mark. Every pattern goes with a visible change,
 * so a haptic is never the only signal. Android Chrome has the Vibration API; iOS Safari has none, so
 * there a tap or a refused take plays the one light tick of a hidden `<input type="checkbox" switch>`
 * (Safari 17.4+), which Safari only plays inside a user gesture. Nothing else is worked around.
 */
export type HapticEvent = SoundEffect | 'tick' | 'go';

/** Vibration patterns in milliseconds: a number is one pulse, an array alternates pulse, pause, pulse. */
export const PATTERNS: Readonly<Record<HapticEvent, number | readonly number[]>> = {
  select: 6,
  place: 12,
  bot: [8, 40, 8],
  refuse: [30, 50, 30],
  tick: 8,
  go: 20,
  win: [20, 40, 20, 40, 60],
  loss: [60, 60, 30],
  draw: [25, 60, 25],
};

/** The events the iOS switch tick may stand in for: a pattern cannot be played there, only one tick. */
export const SWITCH_EVENTS: readonly HapticEvent[] = ['place', 'refuse'];

export interface HapticsPlayer {
  /** Whether this device can give haptics at all (the Settings toggle is hidden when not). */
  readonly supported: boolean;
  /** Plays the event's pattern when allowed; true when something was played. */
  play(event: HapticEvent): boolean;
}

export interface HapticsEnv {
  readonly vibrate?: ((pattern: number | number[]) => boolean) | undefined;
  /** Plays the iOS switch tick; present where the browser supports `switch` checkboxes. */
  readonly tick?: (() => void) | undefined;
  readonly enabled: () => boolean;
}

export function createHaptics(env: HapticsEnv): HapticsPlayer {
  const supported = Boolean(env.vibrate ?? env.tick);
  return {
    supported,
    play(event) {
      if (!env.enabled()) return false;
      if (env.vibrate) {
        const pattern = PATTERNS[event];
        return env.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
      }
      if (env.tick && SWITCH_EVENTS.includes(event)) {
        env.tick();
        return true;
      }
      return false;
    },
  };
}

/** Whether the device or browser asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The iOS tick: a visually hidden label with a `switch` checkbox, clicked from the take's own gesture.
 * It is inert and hidden from assistive technology. Null where `switch` checkboxes are not supported.
 */
function switchTick(): (() => void) | undefined {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return undefined;
  // Only iOS Safari plays a haptic for the switch; elsewhere it would do nothing, so do not claim support.
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return undefined;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return () => label.click();
}

/** The browser's haptics, gated by the setting. */
export function browserHaptics(enabled: () => boolean): HapticsPlayer {
  const vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : undefined;
  return createHaptics({ vibrate, tick: vibrate ? undefined : switchTick(), enabled });
}

export const NO_HAPTICS: HapticsPlayer = { supported: false, play: () => false };
