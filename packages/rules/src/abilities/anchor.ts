import type { AbilityModule } from '../api/abilities';

/** Anchor: protects itself or an adjacent ally from enemy-forced displacement (spec §9). Stub: offers no targets until the full-rules feature. */
export const anchor: AbilityModule = {
  type: 'Anchor',
  targets: () => [],
  resolve: () => [],
};
