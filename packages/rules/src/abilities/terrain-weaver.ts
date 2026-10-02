import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, actorMatches, requireTarget } from './helpers';

/**
 * Terrain Weaver (spec §9): with its current tile matching, it exchanges its tile with an
 * orthogonally adjacent cell's tile, occupied or empty. Fighters and traps stay in their cells and
 * nobody enters a cell, so no trap triggers. The next constraint is the new tile beneath the actor.
 */
export const terrainWeaver: AbilityModule = {
  type: 'TerrainWeaver',
  targets: (context) => (actorMatches(context) ? adjacentCells(actorCell(context)) : []),
  resolve: (context, target) => {
    requireTarget('TerrainWeaver', terrainWeaver.targets(context), target);
    return [
      { kind: 'exchange-terrain', cells: [actorCell(context), target] },
      { kind: 'constraint', rule: { kind: 'tile-under', fighter: context.actor.id } },
    ];
  },
};
