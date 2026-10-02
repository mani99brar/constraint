import { uniformInt } from 'pure-rand/distribution/uniformInt';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import { ALL_CELLS, DISPLACER_TYPES, FIGHTER_TYPES, type Action, type CellId, type FighterType, type PlayerView, type Setup, type SetupInput } from '@okiya/rules';

/** The bot's preferred roster, the B roster of paper test 01. */
export const BOT_ROSTER: readonly FighterType[] = ['Swapper', 'Upgrader', 'Puller', 'Trapper'];

// Salts keep the setup and per-turn streams of one match seed apart.
const SETUP_SALT = 0x5e7a9;
const TURN_SALT = 0x9e3779b1;

/** The bot's generator for one turn, seeded by the match seed and the turn number only. */
function turnGenerator(seed: number, turn: number): RandomGenerator {
  return xoroshiro128plus((seed ^ Math.imul(turn, TURN_SALT)) | 0);
}

function pick<T>(generator: RandomGenerator, items: readonly T[]): T {
  return items[uniformInt(generator, 0, items.length - 1)]!;
}

/**
 * Chooses the bot's secret setup from the revealed board, the preset and the seed: its preferred
 * roster within the preset's displacer limit, and setup traps on distinct random cells.
 */
export function chooseSetup(input: SetupInput): Setup {
  const generator = xoroshiro128plus((input.seed ^ SETUP_SALT) | 0);
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
    traps.push(cells.splice(uniformInt(generator, 0, cells.length - 1), 1)[0]!);
  }
  return { roster, traps };
}

/**
 * Chooses one action from the legal-action list using only the bot's player view. This skeleton
 * bot picks uniformly at random with the generator for the view's seed and turn, so a replay
 * reproduces its choices exactly.
 */
export function chooseAction(view: PlayerView, legalActions: readonly Action[]): Action {
  if (legalActions.length === 0) throw new Error('The bot has no legal action to choose from');
  return pick(turnGenerator(view.seed, view.turn), legalActions);
}
