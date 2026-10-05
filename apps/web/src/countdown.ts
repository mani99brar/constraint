// The short countdown before a new game starts: 3, 2, 1, then the first move. Pure numbers and words;
// the timing lives in `useCountdown`.

/** The number the countdown starts from. */
export const COUNTDOWN_FROM = 3;

/** How long each number shows, in milliseconds: 3 × 600 ms, under two seconds in all. */
export const COUNTDOWN_STEP_MS = 600;

/** The countdown's number in words for screen readers: "Starting in 3", then "Starting in 2", "Starting in 1". */
export function countdownWords(count: number): string {
  return `Starting in ${count}`;
}
