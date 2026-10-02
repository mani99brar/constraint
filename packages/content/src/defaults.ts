import type { CellId, FighterType, PlayerId, Setup } from '@okiya/rules';

/**
 * The fixed default rosters of the skeleton, as in paper test 01: the human plays A, the bot B.
 * Roster selection and trap placement screens come with the full-rules feature.
 */
export const DEFAULT_ROSTERS: Readonly<Record<PlayerId, readonly FighterType[]>> = {
  A: ['Teleporter', 'Pusher', 'TrapChecker', 'TerrainWeaver'],
  B: ['Swapper', 'Upgrader', 'Puller', 'Trapper'],
};

/** Default setup trap cells, as in paper test 01. */
export const DEFAULT_TRAPS: Readonly<Record<PlayerId, readonly CellId[]>> = {
  A: ['B2', 'C3'],
  B: ['A3', 'D2'],
};

export function defaultSetup(player: PlayerId): Setup {
  return { roster: DEFAULT_ROSTERS[player], traps: DEFAULT_TRAPS[player] };
}
