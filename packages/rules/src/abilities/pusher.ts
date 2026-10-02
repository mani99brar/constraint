import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, cellBeyond, cellMatches, fighterAt, requireTarget, shieldedFrom } from './helpers';

/**
 * Pusher (spec §9): an orthogonally adjacent fighter, ally or enemy, on a matching tile moves one
 * cell directly away from the actor, into an in-bounds empty cell. The actor stays. The next
 * constraint is the target's destination tile, which need not match.
 */
export const pusher: AbilityModule = {
  type: 'Pusher',
  targets: (context) => {
    const from = actorCell(context);
    return adjacentCells(from).filter((cell) => {
      const target = fighterAt(context.state, cell);
      if (!target || shieldedFrom(context, target) || !cellMatches(context.state, cell)) return false;
      const beyond = cellBeyond(from, cell, 2);
      return beyond !== null && !fighterAt(context.state, beyond);
    });
  },
  resolve: (context, target) => {
    requireTarget('Pusher', pusher.targets(context), target);
    const destination = cellBeyond(actorCell(context), target, 2)!;
    return [
      { kind: 'relocate', fighter: fighterAt(context.state, target)!.id, to: destination, entry: 'push' },
      { kind: 'constraint', rule: { kind: 'tile-at', cell: destination } },
    ];
  },
};
