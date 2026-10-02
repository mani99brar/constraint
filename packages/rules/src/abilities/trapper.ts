import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, actorMatches, cellMatches, fighterAt, requireTarget } from './helpers';

/**
 * Trapper (spec §9): with its own tile matching, it secretly places one own trap on an
 * orthogonally adjacent cell that is empty or holds an ally, never beneath an enemy and never
 * beyond the preset's live traps per owner per cell. Only its own traps are consulted, so the
 * legal-action list reveals no enemy trap. The preset decides whether the destination must match
 * (`trapperDestinationMustMatch`) and whether the constraint stays (`trapperKeepsConstraint`;
 * otherwise it becomes the actor's tile).
 */
export const trapper: AbilityModule = {
  type: 'Trapper',
  targets: (context) => {
    if (!actorMatches(context)) return [];
    const { state, actor, preset } = context;
    return adjacentCells(actorCell(context)).filter((cell) => {
      const occupant = fighterAt(state, cell);
      if (occupant && occupant.owner !== actor.owner) return false;
      if (preset.trapperDestinationMustMatch && !cellMatches(state, cell)) return false;
      const own = state.traps.filter((trap) => trap.cell === cell && trap.owner === actor.owner).length;
      return own < preset.liveTrapsPerOwnerPerCell;
    });
  },
  resolve: (context, target) => {
    requireTarget('Trapper', trapper.targets(context), target);
    return [
      { kind: 'place-trap', owner: context.actor.owner, cell: target },
      {
        kind: 'constraint',
        rule: context.preset.trapperKeepsConstraint ? { kind: 'unchanged' } : { kind: 'tile-under', fighter: context.actor.id },
      },
    ];
  },
};
