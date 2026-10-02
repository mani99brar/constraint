import type { AbilityModule } from '../api/abilities';

/** Swapper: exchanges places with an adjacent matching fighter (spec §9). Stub: offers no targets until the full-rules feature. */
export const swapper: AbilityModule = {
  type: 'Swapper',
  targets: () => [],
  resolve: () => [],
};
