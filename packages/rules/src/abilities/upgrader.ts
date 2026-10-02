import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, actorMatches, fighterAt, requireTarget } from './helpers';

/**
 * Upgrader (spec §9): with its own tile matching, it transfers its charge to an orthogonally
 * adjacent ally with charge 0 that is not locked. It never targets itself, a charged ally or a
 * locked one, and spends no shared recharge. The next constraint is the actor's tile.
 */
export const upgrader: AbilityModule = {
  type: 'Upgrader',
  targets: (context) => {
    if (!actorMatches(context)) return [];
    return adjacentCells(actorCell(context)).filter((cell) => {
      const ally = fighterAt(context.state, cell);
      return ally !== undefined && ally.owner === context.actor.owner && ally.charge === 0 && ally.lock === null;
    });
  },
  resolve: (context, target) => {
    requireTarget('Upgrader', upgrader.targets(context), target);
    return [
      { kind: 'restore-charge', fighter: fighterAt(context.state, target)!.id },
      { kind: 'constraint', rule: { kind: 'tile-under', fighter: context.actor.id } },
    ];
  },
};
