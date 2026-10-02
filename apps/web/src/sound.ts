/**
 * Short, quiet sound effects synthesized with the Web Audio API (PRD E4). Nothing is created or
 * played before the player's first gesture, nothing plays while muted, and every sound goes with
 * a visible change on screen, so sound is never the only signal of an event.
 */

export type SoundEffect = 'select' | 'place' | 'bot' | 'refuse' | 'win' | 'loss' | 'draw';

/** One tone: a frequency in Hz, a start offset and a length in seconds. */
export interface Tone {
  readonly frequency: number;
  readonly at: number;
  readonly length: number;
  readonly wave: 'sine' | 'triangle' | 'square';
}

/** The loudest a tone gets, as a gain from 0 to 1. */
export const PEAK_GAIN = 0.07;

const tone = (frequency: number, at: number, length: number, wave: Tone['wave'] = 'sine'): Tone => ({ frequency, at, length, wave });

export const EFFECTS: Readonly<Record<SoundEffect, readonly Tone[]>> = {
  select: [tone(660, 0, 0.06, 'triangle')],
  place: [tone(523, 0, 0.08, 'triangle'), tone(784, 0.07, 0.1, 'triangle')],
  bot: [tone(392, 0, 0.08), tone(330, 0.07, 0.1)],
  refuse: [tone(196, 0, 0.12, 'triangle')],
  win: [tone(523, 0, 0.1), tone(659, 0.1, 0.1), tone(784, 0.2, 0.22)],
  loss: [tone(392, 0, 0.12), tone(311, 0.12, 0.12), tone(262, 0.24, 0.22)],
  draw: [tone(440, 0, 0.12), tone(440, 0.16, 0.16)],
};

/** The parts of the Web Audio API the effects use, so tests can pass a fake. */
export interface AudioNodeLike {
  connect(destination: unknown): unknown;
}
export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  start(when: number): void;
  stop(when: number): void;
}
export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state: string;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface SoundPlayer {
  /**
   * Called from every pointer or key gesture's own handler: the first unmuted one creates and
   * resumes the audio context, which Safari only allows inside a gesture. Until then `play` stays silent.
   */
  unlock(): void;
  /** Plays an effect; returns whether anything was played. */
  play(effect: SoundEffect): boolean;
}

export interface SoundOptions {
  /** Creates the audio context, on the first sound after a gesture; null where there is none. */
  readonly createContext: () => AudioContextLike | null;
  readonly muted: () => boolean;
}

export function createSoundPlayer({ createContext, muted }: SoundOptions): SoundPlayer {
  let unlocked = false;
  let context: AudioContextLike | null = null;
  return {
    unlock() {
      unlocked = true;
      if (muted()) return;
      try {
        context ??= createContext();
        if (context?.state === 'suspended') void context.resume().catch(() => {});
      } catch {
        context = null;
      }
    },
    play(effect) {
      if (!unlocked || muted()) return false;
      try {
        context ??= createContext();
        if (!context) return false;
        const start = context.currentTime + 0.01;
        for (const { frequency, at, length, wave } of EFFECTS[effect]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = wave;
          oscillator.frequency.setValueAtTime(frequency, start + at);
          gain.gain.setValueAtTime(0.0001, start + at);
          gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start + at);
          oscillator.stop(start + at + length + 0.02);
        }
        return true;
      } catch {
        // Audio is a nicety: a browser that refuses it leaves the game silent, not broken.
        return false;
      }
    },
  };
}

/** The browser's audio context constructor, or null where there is none. */
export function browserAudioContext(): AudioContextLike | null {
  const Constructor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  return Constructor ? (new Constructor() as unknown as AudioContextLike) : null;
}
