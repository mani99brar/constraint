import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import type { Player } from './state';
import { TILES, type Tile } from './board';

/**
 * The seeded setup (spec §2, §6): a Fisher–Yates shuffle of the 16 tiles, then a starting player when none is
 * given. The same seed always gives the same board.
 */
export function seededSetup(seed: number): { readonly board: readonly Tile[]; readonly starter: Player } {
  const generator = xoroshiro128plus(seed);
  const board = [...TILES];
  for (let i = board.length - 1; i > 0; i -= 1) {
    const j = uniformInt(generator, 0, i);
    [board[i], board[j]] = [board[j]!, board[i]!];
  }
  const starter: Player = uniformInt(generator, 0, 1) === 0 ? 'A' : 'B';
  return { board, starter };
}
