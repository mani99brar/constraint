import type { FighterDefinition, ObjectiveDefinition } from '@okiya/rules';

/** The fighter pool (spec §9). */
export const FIGHTERS: readonly FighterDefinition[] = [
  { type: 'Teleporter', name: 'Teleporter', abbreviation: 'TP', displacer: false, summary: 'Moves directly to any empty matching cell.' },
  { type: 'Pusher', name: 'Pusher', abbreviation: 'PU', displacer: true, summary: 'Pushes an adjacent matching fighter one cell directly away.' },
  { type: 'Swapper', name: 'Swapper', abbreviation: 'SW', displacer: true, summary: 'Exchanges places with an adjacent matching fighter.' },
  { type: 'Upgrader', name: 'Upgrader', abbreviation: 'UP', displacer: false, summary: 'Transfers its charge to an adjacent spent, unlocked ally.' },
  { type: 'TrapChecker', name: 'Trap Checker', abbreviation: 'TC', displacer: false, summary: 'Inspects one adjacent empty or enemy cell and removes enemy traps there.' },
  { type: 'Puller', name: 'Puller', abbreviation: 'PL', displacer: true, summary: 'Pulls a matching fighter two cells away into the empty cell between.' },
  { type: 'Anchor', name: 'Anchor', abbreviation: 'AN', displacer: false, summary: 'Protects itself or an adjacent ally from enemy push, pull or swap.' },
  { type: 'TerrainWeaver', name: 'Terrain Weaver', abbreviation: 'TW', displacer: false, summary: 'Exchanges its tile with an adjacent tile.' },
  { type: 'Trapper', name: 'Trapper', abbreviation: 'TR', displacer: false, summary: 'Secretly places a trap on an adjacent empty or allied cell.' },
];

export const OBJECTIVES: readonly ObjectiveDefinition[] = [
  { id: 'Square', name: 'Square', summary: 'All four of your fighters occupy the four cells of one 2×2 square.' },
];
