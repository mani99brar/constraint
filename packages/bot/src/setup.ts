import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { ALL_CELLS, DISPLACER_TYPES, FIGHTER_TYPES, SQUARES, type CellId, type FighterType, type Setup, type SetupInput } from '@okiya/rules';

/**
 * The bot's preferred roster, the B roster of paper test 01: two displacers, since displacement
 * decided that game (`paper-test-01.md` F2), plus a charge source and a trap layer.
 */
export const BOT_ROSTER: readonly FighterType[] = ['Swapper', 'Upgrader', 'Puller', 'Trapper'];

/** How many of the nine squares contain a cell; central cells are where squares close. */
function squareWeight(cell: CellId): number {
  return SQUARES.filter((square) => square.includes(cell)).length;
}

/**
 * Chooses the bot's secret setup from the revealed board, the preset and its private seed only:
 * its preferred roster within the preset's displacer limit, filled up in pool order, and setup
 * traps on distinct cells drawn with weight on the cells most squares need.
 */
export function chooseSetup(input: SetupInput): Setup {
  const generator = xoroshiro128plus(input.privateSeed | 0);
  const limit = input.preset.variants.displacerLimit ?? Number.POSITIVE_INFINITY;
  const roster: FighterType[] = [];
  let displacers = 0;
  for (const type of [...BOT_ROSTER, ...FIGHTER_TYPES]) {
    if (roster.length === input.preset.rosterSize || roster.includes(type)) continue;
    const isDisplacer = DISPLACER_TYPES.includes(type);
    if (isDisplacer && displacers >= limit) continue;
    roster.push(type);
    if (isDisplacer) displacers += 1;
  }
  const cells = [...ALL_CELLS];
  const traps: CellId[] = [];
  for (let i = 0; i < input.preset.setupTrapsPerPlayer && cells.length > 0; i += 1) {
    const total = cells.reduce((sum, cell) => sum + squareWeight(cell), 0);
    let draw = uniformInt(generator, 0, total - 1);
    let index = 0;
    while (draw >= squareWeight(cells[index]!)) {
      draw -= squareWeight(cells[index]!);
      index += 1;
    }
    traps.push(cells.splice(index, 1)[0]!);
  }
  return { roster, traps };
}
