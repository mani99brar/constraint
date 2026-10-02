import type { AbilityModule } from '../api/abilities';

/** Puller: pulls a matching fighter two cells away into the empty cell between (spec §9). Stub: offers no targets until the full-rules feature. */
export const puller: AbilityModule = {
  type: 'Puller',
  targets: () => [],
  resolve: () => [],
};
