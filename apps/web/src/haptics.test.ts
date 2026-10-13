import { describe, expect, it, vi } from 'vitest';
import { PATTERNS, SWITCH_EVENTS, createHaptics, type HapticEvent } from './haptics';
import { EFFECTS } from './sound';
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from './settings';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

// Haptics: one pattern per moment the sounds mark, plus the countdown's tick and go, played through the
// Vibration API where it exists, through the iOS switch tick for a take and a refusal only, and never
// when the setting is off.

describe('haptic patterns', () => {
  it('names a pattern for every sound effect, the countdown tick and the go', () => {
    for (const effect of Object.keys(EFFECTS)) expect(PATTERNS, effect).toHaveProperty(effect);
    expect(PATTERNS).toHaveProperty('tick');
    expect(PATTERNS).toHaveProperty('go');
  });

  it('keeps each pattern short and in the spec: a 12 ms tick for a take, a double buzz for a refusal, a rising result', () => {
    expect(PATTERNS.place).toBe(12);
    expect(PATTERNS.refuse).toEqual([30, 50, 30]);
    expect(PATTERNS.tick).toBe(8);
    expect(PATTERNS.go).toBe(20);
    expect(PATTERNS.win).toEqual([20, 40, 20, 40, 60]);
    expect(PATTERNS.loss).toEqual([60, 60, 30]);
    expect(PATTERNS.draw).toEqual([25, 60, 25]);
    for (const [name, pattern] of Object.entries(PATTERNS)) {
      const total = typeof pattern === 'number' ? pattern : pattern.reduce((sum, ms) => sum + ms, 0);
      expect(total, name).toBeLessThanOrEqual(250);
    }
  });
});

describe('the haptics player', () => {
  it('vibrates with the event’s pattern when enabled', () => {
    const vibrate = vi.fn(() => true);
    const player = createHaptics({ vibrate, enabled: () => true });
    expect(player.supported).toBe(true);
    expect(player.play('place')).toBe(true);
    expect(player.play('refuse')).toBe(true);
    expect(vibrate.mock.calls).toEqual([[12], [[30, 50, 30]]]);
  });

  it('plays nothing while the setting is off', () => {
    const vibrate = vi.fn(() => true);
    const tick = vi.fn();
    const player = createHaptics({ vibrate, tick, enabled: () => false });
    for (const event of Object.keys(PATTERNS) as HapticEvent[]) expect(player.play(event)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    expect(tick).not.toHaveBeenCalled();
  });

  it('is unsupported, and silent, with neither the Vibration API nor the iOS switch', () => {
    const player = createHaptics({ enabled: () => true });
    expect(player.supported).toBe(false);
    expect(player.play('place')).toBe(false);
  });

  it('uses the iOS switch tick for a take and a refusal only, since it cannot play a pattern or run outside a gesture', () => {
    const tick = vi.fn();
    const player = createHaptics({ tick, enabled: () => true });
    expect(player.supported).toBe(true);
    expect([...SWITCH_EVENTS].sort()).toEqual(['place', 'refuse']);
    for (const event of Object.keys(PATTERNS) as HapticEvent[]) player.play(event);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('prefers the Vibration API when both exist', () => {
    const vibrate = vi.fn(() => true);
    const tick = vi.fn();
    createHaptics({ vibrate, tick, enabled: () => true }).play('place');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(tick).not.toHaveBeenCalled();
  });
});

describe('the haptics setting', () => {
  it('is on by default, off at first under reduced motion, and a stored choice wins either way', () => {
    expect(DEFAULT_SETTINGS.haptics).toBe(true);
    expect(loadSettings(memoryStorage()).haptics).toBe(true);
    expect(loadSettings(memoryStorage(), true).haptics).toBe(false);
    const stored = memoryStorage();
    stored.data.set(SETTINGS_KEY, JSON.stringify({ haptics: true }));
    expect(loadSettings(stored, true).haptics).toBe(true);
    stored.data.set(SETTINGS_KEY, JSON.stringify({ haptics: false }));
    expect(loadSettings(stored).haptics).toBe(false);
    // The backdrop and the scene motion are on at first, and a stored choice wins.
    expect(DEFAULT_SETTINGS.backdrop).toBe(true);
    expect(DEFAULT_SETTINGS.sceneMotion).toBe(true);
    stored.data.set(SETTINGS_KEY, JSON.stringify({ backdrop: false, sceneMotion: false }));
    expect(loadSettings(stored)).toMatchObject({ backdrop: false, sceneMotion: false });
    // Other settings keep their defaults under reduced motion.
    expect(loadSettings(memoryStorage(), true)).toEqual({ ...DEFAULT_SETTINGS, haptics: false });
  });
});
