import { PLAYERS, type Player } from '@okiya/game';

// Chess clocks for a two-player game: each player may have their own time, at most five minutes, or no
// clock at all. Only the clock of the player to move runs; a take hands the time over. Running out of
// time loses the game (`outOfTime` in @okiya/game). Pure: the caller passes the time, in milliseconds.

/** The choices the home screen offers for each player's clock: off, or one to five minutes. */
export const CLOCK_CHOICES = ['off', '1', '2', '3', '4', '5'] as const;
export type ClockChoice = (typeof CLOCK_CHOICES)[number];

export const CLOCK_OPTIONS: readonly { readonly id: ClockChoice; readonly label: string }[] = CLOCK_CHOICES.map((id) => ({
  id,
  label: id === 'off' ? 'Off' : `${id} min`,
}));

/** The most time a player may have. */
export const MAX_CLOCK_MS = 5 * 60_000;

/** Under this, a clock shows as running low. */
export const LOW_CLOCK_MS = 10_000;

/** A choice as the slider's position: 0 for off, else its minutes. */
export function clockMinutes(choice: ClockChoice): number {
  return choice === 'off' ? 0 : Number(choice);
}

/** The choice at a slider position, clamped to off..five minutes and rounded to a whole minute. */
export function clockChoiceAt(minutes: number): ClockChoice {
  const whole = Math.min(5, Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0)));
  return CLOCK_CHOICES[whole]!;
}

/** A choice in words, for the slider's screen-reader value: "Off", "1 minute", "3 minutes". */
export function clockChoiceWords(choice: ClockChoice): string {
  if (choice === 'off') return 'Off';
  return `${choice} minute${choice === '1' ? '' : 's'}`;
}

export function isClockChoice(value: unknown): value is ClockChoice {
  return (CLOCK_CHOICES as readonly unknown[]).includes(value);
}

/** Each player's starting time in milliseconds, or null for a player without a clock. */
export type ClockTimes = Readonly<Record<Player, number | null>>;

/** The starting times a pair of choices gives, or null when neither player has a clock. */
export function clockSetup(a: ClockChoice, b: ClockChoice): ClockTimes | null {
  const ms = (choice: ClockChoice) => (choice === 'off' ? null : Number(choice) * 60_000);
  const times = { A: ms(a), B: ms(b) };
  return times.A === null && times.B === null ? null : times;
}

/** Whether stored times are usable: each null or a whole number of milliseconds from 0 to five minutes. */
export function isClockTimes(value: unknown): value is ClockTimes {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const valid = (time: unknown) => time === null || (typeof time === 'number' && Number.isInteger(time) && time >= 0 && time <= MAX_CLOCK_MS);
  return PLAYERS.every((player) => valid(record[player])) && PLAYERS.some((player) => record[player] !== null);
}

/** The clocks of a game: each player's time left when their clock last stopped, and whose runs since when. */
export interface Clock {
  readonly left: ClockTimes;
  readonly running: Player | null;
  /** When the running clock started, in milliseconds. */
  readonly since: number;
}

export function startClock(left: ClockTimes, running: Player | null, now: number): Clock {
  return { left, running: running !== null && left[running] !== null ? running : null, since: now };
}

/** A player's time left at `now`, never below zero, or null for a player without a clock. */
export function timeLeft(clock: Clock, player: Player, now: number): number | null {
  const left = clock.left[player];
  if (left === null) return null;
  return clock.running === player ? Math.max(0, left - Math.max(0, now - clock.since)) : left;
}

/** Stops the running clock at `now` and starts `player`'s (null: no clock runs, as while paused or ended). */
export function runClock(clock: Clock, player: Player | null, now: number): Clock {
  const left: ClockTimes = { A: timeLeft(clock, 'A', now), B: timeLeft(clock, 'B', now) };
  return startClock(left, player, now);
}

/** Every player's time left at `now`. */
export function timesLeft(clock: Clock, now: number): ClockTimes {
  return { A: timeLeft(clock, 'A', now), B: timeLeft(clock, 'B', now) };
}

/** The player whose running clock has reached zero at `now`, or null. */
export function outOfTimePlayer(clock: Clock, now: number): Player | null {
  const { running } = clock;
  return running !== null && timeLeft(clock, running, now) === 0 ? running : null;
}

/** Whole seconds left, rounded up, so a clock shows 0:00 only once the time is gone. */
function secondsLeft(ms: number): number {
  return Math.ceil(ms / 1000);
}

/** A clock's face: "4:59", "0:09", "0:00". */
export function clockText(ms: number): string {
  const seconds = secondsLeft(ms);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A clock in words for screen readers: "4 minutes 59 seconds left", "1 minute left", "no time left". */
export function clockWords(ms: number): string {
  const seconds = secondsLeft(ms);
  if (seconds === 0) return 'no time left';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts = [minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '', rest ? `${rest} second${rest === 1 ? '' : 's'}` : ''].filter(Boolean);
  return `${parts.join(' ')} left`;
}
