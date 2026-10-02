import type { AbilityModule } from '../api/abilities';
import { actorCell, cellMatches, cellsTwoAway, fighterAt, requireTarget, shieldedFrom } from './helpers';

/**
 * Puller (spec §9): a fighter exactly two cells away along a row or column, on a matching tile,
 * moves into the empty cell between. The actor stays. Whether allies may be pulled is the
 * preset's `pullerMayTargetAllies` variant (PRD §6). The next constraint is the target's
 * destination tile, which need not match.
 */
export const puller: AbilityModule = {
  type: 'Puller',
  targets: (context) =>
    cellsTwoAway(actorCell(context))
      .filter(({ target, between }) => {
        const fighter = fighterAt(context.state, target);
        if (!fighter || fighterAt(context.state, between) || !cellMatches(context.state, target)) return false;
        if (fighter.owner === context.actor.owner && !context.preset.variants.pullerMayTargetAllies) return false;
        return !shieldedFrom(context, fighter);
      })
      .map(({ target }) => target),
  resolve: (context, target) => {
    requireTarget('Puller', puller.targets(context), target);
    const { between } = cellsTwoAway(actorCell(context)).find((pair) => pair.target === target)!;
    return [
      { kind: 'relocate', fighter: fighterAt(context.state, target)!.id, to: between, entry: 'pull' },
      { kind: 'constraint', rule: { kind: 'tile-at', cell: between } },
    ];
  },
};
