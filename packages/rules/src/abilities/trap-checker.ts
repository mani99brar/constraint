import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, actorMatches, fighterAt, requireTarget } from './helpers';

/**
 * Trap Checker (spec v0.2 §9): with its own tile matching, it inspects one orthogonally adjacent
 * cell that is empty or holds an enemy, and removes the enemy traps there; friendly traps stay.
 * The target never depends on traps, so the legal-action list reveals none (legal with nothing
 * found). The result is private to the inspector. The next constraint is the actor's tile.
 */
export const trapChecker: AbilityModule = {
  type: 'TrapChecker',
  targets: (context) => {
    if (!actorMatches(context)) return [];
    return adjacentCells(actorCell(context)).filter((cell) => {
      const occupant = fighterAt(context.state, cell);
      return occupant === undefined || occupant.owner !== context.actor.owner;
    });
  },
  resolve: (context, target) => {
    requireTarget('TrapChecker', trapChecker.targets(context), target);
    return [
      { kind: 'remove-enemy-traps', inspector: context.actor.owner, cell: target },
      { kind: 'constraint', rule: { kind: 'tile-under', fighter: context.actor.id } },
    ];
  },
};
