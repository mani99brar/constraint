import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, actorMatches, fighterAt, requireTarget } from './helpers';

/**
 * Anchor (spec §9): with its own tile matching, it protects itself or an orthogonally adjacent
 * ally from enemy-forced push, pull or swap. Protection cannot stack: an already protected target
 * is illegal. Core computes the expiry from the preset's `anchorProtection` variant. The next
 * constraint is the actor's tile.
 */
export const anchor: AbilityModule = {
  type: 'Anchor',
  targets: (context) => {
    if (!actorMatches(context)) return [];
    const from = actorCell(context);
    return [from, ...adjacentCells(from)].filter((cell) => {
      const ally = fighterAt(context.state, cell);
      return ally !== undefined && ally.owner === context.actor.owner && ally.protection === null;
    });
  },
  resolve: (context, target) => {
    requireTarget('Anchor', anchor.targets(context), target);
    return [
      { kind: 'protect', fighter: fighterAt(context.state, target)!.id },
      { kind: 'constraint', rule: { kind: 'tile-under', fighter: context.actor.id } },
    ];
  },
};
