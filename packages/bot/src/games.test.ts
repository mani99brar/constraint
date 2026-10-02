import { describe, expect, it } from 'vitest';
import { legalTakes, type GameState } from '@okiya/game';
import { chooseTake, POSITION_BUDGET, type Difficulty } from './index';
import { opponentCanWinAtOnce, playGame, winsAtOnce, type PlayedGame } from './test-support';

// Bot-against-bot games with alternating starters: Easy against Normal and Normal against itself over seeds 0–49,
// and Hard against Hard, Normal and Easy over seeds 0–9.
const MATCHUPS: readonly { readonly a: Difficulty; readonly b: Difficulty; readonly seeds: number }[] = [
  { a: 'easy', b: 'normal', seeds: 50 },
  { a: 'normal', b: 'normal', seeds: 50 },
  { a: 'hard', b: 'hard', seeds: 10 },
  { a: 'hard', b: 'normal', seeds: 10 },
  { a: 'hard', b: 'easy', seeds: 10 },
];

let played: PlayedGame[] | undefined;
function games(): PlayedGame[] {
  played ??= MATCHUPS.flatMap(({ a, b, seeds }) =>
    Array.from({ length: seeds }, (_, seed) => playGame(seed, seed % 2 === 0 ? 'A' : 'B', a, b)),
  );
  return played;
}

const turns = () => games().flatMap((game) => game.turns);

describe('bot-against-bot games', () => {
  it('every take is legal, and chooseTake gives the take its analysis reports', { timeout: 60_000 }, () => {
    expect(games()).toHaveLength(130);
    for (const { state, difficulty, analysis } of turns()) {
      expect(legalTakes(state)).toContain(analysis.take);
      expect(chooseTake(state, { difficulty })).toBe(analysis.take);
    }
  });

  it('a second call on the same state, or a copy of it, gives the same take', { timeout: 60_000 }, () => {
    const all = turns();
    const step = Math.floor(all.length / 20);
    const sample = Array.from({ length: 20 }, (_, k) => all[k * step]!);
    expect(new Set(sample.map(({ difficulty }) => difficulty)).size).toBe(3);
    for (const { state, difficulty, analysis } of sample) {
      const copy = JSON.parse(JSON.stringify(state)) as GameState;
      expect(chooseTake(state, { difficulty })).toBe(analysis.take);
      expect(chooseTake(copy, { difficulty })).toBe(analysis.take);
    }
  });

  it('every take searches at most the position budget, and Hard solves exactly within it after the opening', { timeout: 60_000 }, () => {
    let hardSolves = 0;
    for (const { state, difficulty, analysis } of turns()) {
      expect(analysis.positions).toBeLessThanOrEqual(POSITION_BUDGET);
      if (difficulty === 'hard' && state.lastTile !== null) {
        expect(analysis.solved).toBe(true);
        hardSolves += 1;
      }
    }
    expect(hardSolves).toBeGreaterThan(30);
  });

  it('every bot takes an immediate win, and Normal and Hard avoid one for the opponent when they can', { timeout: 60_000 }, () => {
    let wins = 0;
    let avoided = 0;
    for (const { state, difficulty, analysis } of turns()) {
      const takes = legalTakes(state);
      if (takes.some((cell) => winsAtOnce(state, cell))) {
        expect(winsAtOnce(state, analysis.take)).toBe(true);
        wins += 1;
      } else if (difficulty !== 'easy' && takes.some((cell) => !opponentCanWinAtOnce(state, cell))) {
        expect(opponentCanWinAtOnce(state, analysis.take)).toBe(false);
        if (takes.some((cell) => opponentCanWinAtOnce(state, cell))) avoided += 1;
      }
    }
    expect(wins).toBeGreaterThan(0);
    expect(avoided).toBeGreaterThan(0);
  });
});
