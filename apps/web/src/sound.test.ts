import { describe, expect, it } from 'vitest';
import { createSoundPlayer, EFFECTS, PEAK_GAIN, type AudioContextLike, type SoundEffect } from './sound';

/** A fake audio context that records every tone started. */
function fakeAudio() {
  const started: number[] = [];
  let created = 0;
  let resumed = 0;
  const param = { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  const context: AudioContextLike = {
    currentTime: 0,
    destination: {},
    state: 'suspended',
    resume: async () => {
      resumed += 1;
    },
    createOscillator: () => ({ type: 'sine', frequency: param, connect: () => {}, start: (when) => void started.push(when), stop: () => {} }),
    createGain: () => ({ gain: param, connect: () => {} }),
  };
  return {
    started,
    created: () => created,
    resumed: () => resumed,
    createContext: () => {
      created += 1;
      return context;
    },
  };
}

describe('sound effects (PRD E4)', () => {
  it('stays silent and creates no audio before any user gesture', () => {
    const audio = fakeAudio();
    const sound = createSoundPlayer({ createContext: audio.createContext, muted: () => false });
    for (const effect of Object.keys(EFFECTS) as SoundEffect[]) expect(sound.play(effect)).toBe(false);
    expect(audio.created()).toBe(0);
    expect(audio.started).toEqual([]);
  });

  it('stays silent while muted, even after a gesture', () => {
    const audio = fakeAudio();
    const sound = createSoundPlayer({ createContext: audio.createContext, muted: () => true });
    sound.unlock();
    for (const effect of Object.keys(EFFECTS) as SoundEffect[]) expect(sound.play(effect)).toBe(false);
    expect(audio.created()).toBe(0);
    expect(audio.started).toEqual([]);
  });

  it('creates and resumes the context inside the gesture, then plays when unmuted', () => {
    const audio = fakeAudio();
    let muted = true;
    const sound = createSoundPlayer({ createContext: audio.createContext, muted: () => muted });
    sound.unlock();
    expect(sound.play('place')).toBe(false);
    muted = false;
    sound.unlock();
    expect(audio.created()).toBe(1);
    expect(audio.resumed()).toBe(1);
    expect(audio.started).toEqual([]);
    expect(sound.play('place')).toBe(true);
    expect(audio.started).toHaveLength(EFFECTS.place.length);
    expect(audio.created()).toBe(1);
  });

  it('keeps every effect short and quiet', () => {
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.1);
    for (const tones of Object.values(EFFECTS)) {
      const end = Math.max(...tones.map((tone) => tone.at + tone.length));
      expect(end).toBeLessThanOrEqual(0.5);
    }
  });

  it('stays silent where audio is unavailable or throws', () => {
    const none = createSoundPlayer({ createContext: () => null, muted: () => false });
    none.unlock();
    expect(none.play('win')).toBe(false);
    const broken = createSoundPlayer({
      createContext: () => {
        throw new Error('NotAllowedError');
      },
      muted: () => false,
    });
    expect(() => broken.unlock()).not.toThrow();
    expect(broken.play('win')).toBe(false);
  });
});
