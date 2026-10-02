import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus';
import type { RngState } from '../api/state';

// Every draw restores the generator from plain state and returns its next state, so the
// match state stays serializable and replays exactly.

export function createRng(seed: number): RngState {
  return xoroshiro128plus(seed).getState();
}

export function drawInt(rng: RngState, min: number, max: number): [number, RngState] {
  const generator = xoroshiro128plusFromState(rng);
  const value = uniformInt(generator, min, max);
  return [value, generator.getState()];
}

/** Fisher–Yates shuffle driven by the seeded generator. */
export function shuffle<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  const generator = xoroshiro128plusFromState(rng);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = uniformInt(generator, 0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return [result, generator.getState()];
}
