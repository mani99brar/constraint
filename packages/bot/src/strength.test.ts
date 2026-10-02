import { describe, expect, it } from 'vitest';
import { legalTakes, type Player } from '@okiya/game';
import type { Difficulty } from './index';
import { opponentCanWinAtOnce, playGame, ReferenceSolver, winsAtOnce, type PlayedGame } from './test-support';

// Strength over seeds 0–39 exactly, fixed before any game is played. The first difficulty plays A and the starter
// alternates with the seed. A win scores 1, a draw ½ and a loss 0. Hard's play is checked against the reference
// solver of `test-support.ts`, which shares no code with the bot's solver.

const SEEDS = Array.from({ length: 40 }, (_, seed) => seed);
const PERFECT_SEEDS = 20;

const played = new Map<string, PlayedGame[]>();
function games(a: Difficulty, b: Difficulty): PlayedGame[] {
  const key = `${a}-${b}`;
  let list = played.get(key);
  if (!list) {
    list = SEEDS.map((seed) => playGame(seed, seed % 2 === 0 ? 'A' : 'B', a, b));
    played.set(key, list);
  }
  return list;
}

function score(list: readonly PlayedGame[], player: Player): number {
  return list.reduce((sum, { final }) => {
    const result = final.result!;
    return sum + (result.kind === 'draw' ? 0.5 : result.winner === player ? 1 : 0);
  }, 0);
}

/** One reference solver per seed: games on the same seed share a board, so they share its memo. */
const references = new Map<number, ReferenceSolver>();
function reference(game: PlayedGame): ReferenceSolver {
  let solver = references.get(game.seed);
  if (!solver) {
    solver = new ReferenceSolver(game.turns[0]!.state.board);
    references.set(game.seed, solver);
  }
  return solver;
}

describe('strength over seeds 0–39', () => {
  it('Hard never loses a game it can still save at its first take after the opening', { timeout: 90_000 }, () => {
    let saved = 0;
    for (const list of [games('hard', 'normal'), games('hard', 'easy')]) {
      for (const game of list) {
        const first = game.turns.find(({ state, difficulty }) => difficulty === 'hard' && state.lastTile !== null)!;
        expect(first.state.toMove).toBe('A');
        const value = reference(game).value(first.state);
        const result = game.final.result!;
        const hardLost = result.kind === 'win' && result.winner !== 'A';
        if (value >= 0) {
          expect(hardLost, `seed ${game.seed}`).toBe(false);
          saved += 1;
        }
        if (value === 1) expect(result.kind === 'win' && result.winner === 'A', `seed ${game.seed}`).toBe(true);
      }
    }
    expect(saved).toBeGreaterThan(0);
  });

  it('Hard scores at least as much as Normal and more than Easy, and Normal more than Easy', { timeout: 60_000 }, () => {
    const hardNormal = games('hard', 'normal');
    const hardEasy = games('hard', 'easy');
    const normalEasy = games('normal', 'easy');
    expect(score(hardNormal, 'A')).toBeGreaterThanOrEqual(score(hardNormal, 'B'));
    expect(score(hardEasy, 'A')).toBeGreaterThan(score(hardEasy, 'B'));
    expect(score(normalEasy, 'A')).toBeGreaterThan(score(normalEasy, 'B'));
  });
});

describe('Hard is perfect', () => {
  it('from the second take on, over seeds 0–19, Hard’s take keeps the best value and wins at once when it can, and when lost avoids an immediate loss', { timeout: 90_000 }, () => {
    const list = [
      ...games('hard', 'normal').slice(0, PERFECT_SEEDS),
      ...games('hard', 'easy').slice(0, PERFECT_SEEDS),
      ...SEEDS.slice(0, PERFECT_SEEDS).map((seed) => playGame(seed, seed % 2 === 0 ? 'A' : 'B', 'hard', 'hard')),
    ];
    let checked = 0;
    let losing = 0;
    for (const game of list) {
      for (const { state, difficulty, analysis } of game.turns) {
        if (difficulty !== 'hard' || state.lastTile === null) continue;
        const values = reference(game).takeValues(state);
        expect([...values.keys()]).toEqual(legalTakes(state));
        const best = Math.max(...values.values());
        expect(values.get(analysis.take), `seed ${game.seed}, take ${state.takes.length + 1}`).toBe(best);
        // The bot's own values for every take agree with the reference too.
        expect(analysis.values).toEqual(values);
        if (legalTakes(state).some((cell) => winsAtOnce(state, cell))) expect(winsAtOnce(state, analysis.take)).toBe(true);
        if (best === -1 && legalTakes(state).some((cell) => !opponentCanWinAtOnce(state, cell))) {
          expect(opponentCanWinAtOnce(state, analysis.take)).toBe(false);
          losing += 1;
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(losing).toBeGreaterThan(0);
  });
});
