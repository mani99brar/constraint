import { ALL_CELLS } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, cellMatches, fighterAt, requireTarget } from './helpers';

/**
 * Teleporter (spec §9): moves directly to any empty matching cell other than its own. No cell in
 * between is entered; the destination's traps resolve, after the charge is spent (spec §8.2).
 */
export const teleporter: AbilityModule = {
  type: 'Teleporter',
  targets: (context) => {
    const from = actorCell(context);
    return ALL_CELLS.filter((cell) => cell !== from && !fighterAt(context.state, cell) && cellMatches(context.state, cell));
  },
  resolve: (context, target) => {
    requireTarget('Teleporter', teleporter.targets(context), target);
    return [
      { kind: 'relocate', fighter: context.actor.id, to: target, entry: 'teleport' },
      { kind: 'constraint', rule: { kind: 'tile-at', cell: target } },
    ];
  },
};
