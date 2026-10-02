import { adjacentCells } from '../api/board';
import type { AbilityModule } from '../api/abilities';
import { actorCell, cellMatches, fighterAt, requireTarget, shieldedFrom } from './helpers';

/**
 * Swapper (spec §9): exchanges places with an orthogonally adjacent fighter, ally or enemy, on a
 * matching tile. Both fighters enter a cell, so both entries resolve traps after the exchange
 * (spec §8.3). The next constraint is the actor's destination tile.
 */
export const swapper: AbilityModule = {
  type: 'Swapper',
  targets: (context) =>
    adjacentCells(actorCell(context)).filter((cell) => {
      const target = fighterAt(context.state, cell);
      return target !== undefined && !shieldedFrom(context, target) && cellMatches(context.state, cell);
    }),
  resolve: (context, target) => {
    requireTarget('Swapper', swapper.targets(context), target);
    const from = actorCell(context);
    return [
      { kind: 'relocate', fighter: context.actor.id, to: target, entry: 'swap' },
      { kind: 'relocate', fighter: fighterAt(context.state, target)!.id, to: from, entry: 'swap' },
      { kind: 'constraint', rule: { kind: 'tile-at', cell: target } },
    ];
  },
};
