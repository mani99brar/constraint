import { describe, expect, it } from 'vitest';
import { legalTakes, newGame, take, type CellId, type GameState } from '@okiya/game';
import { chooseTake } from './index';
import { normalTakeAtDepth } from './take';

// Normal searches three takes (PRD B2): its own take, the opponent's reply and its own next take. Only a
// three-take search sees a forced win in three: a take after which every reply leaves Normal an immediate win.
// These positions are found through the engine alone (`take`, `legalTakes`), independently of the bot's code.

function after(state: GameState, cell: CellId): GameState {
  const next = take(state, cell);
  if (!next.ok) throw new Error(`illegal take ${cell}`);
  return next.state;
}

function winsAtOnce(state: GameState, cell: CellId): boolean {
  const next = after(state, cell);
  return next.result?.kind === 'win' && next.result.winner === state.toMove;
}

/** The takes after which the game goes on and every reply leaves the player an immediate win. */
function forcedWinsInThree(state: GameState): CellId[] {
  return legalTakes(state).filter((cell) => {
    const next = after(state, cell);
    if (next.result) return false;
    return legalTakes(next).every((reply) => {
      const answered = after(next, reply);
      return !answered.result && legalTakes(answered).some((finish) => winsAtOnce(answered, finish));
    });
  });
}

interface Found {
  readonly state: GameState;
  readonly forced: readonly CellId[];
}

/** Positions from Normal-against-Easy games with a forced win in three and no immediate win. */
function positionsWithForcedWins(): Found[] {
  const found: Found[] = [];
  for (let seed = 0; seed < 60; seed += 1) {
    let state = newGame({ seed, starter: seed % 2 === 0 ? 'A' : 'B' });
    while (!state.result) {
      if (state.lastTile !== null && !legalTakes(state).some((cell) => winsAtOnce(state, cell))) {
        const forced = forcedWinsInThree(state);
        if (forced.length > 0) found.push({ state, forced });
      }
      state = after(state, chooseTake(state, { difficulty: state.toMove === 'A' ? 'normal' : 'easy' }));
    }
  }
  return found;
}

describe('Normal searches three takes (PRD B2)', () => {
  const found = positionsWithForcedWins();

  it('finds positions with a forced win in three', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it('always takes a forced win in three when no immediate win exists', () => {
    for (const { state, forced } of found) expect(forced, `seed ${state.seed}, takes ${state.takes.join(' ')}`).toContain(chooseTake(state, { difficulty: 'normal' }));
  });

  it('differs from a two-take search, which misses some of them', () => {
    const missedAtTwo = found.filter(({ state, forced }) => !forced.includes(normalTakeAtDepth(state, 2)));
    expect(missedAtTwo.length).toBeGreaterThan(0);
    for (const { state, forced } of missedAtTwo) expect(forced).toContain(normalTakeAtDepth(state, 3));
  });
}, 60_000);
