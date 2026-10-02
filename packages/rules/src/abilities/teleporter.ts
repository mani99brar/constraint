import type { AbilityModule } from '../api/abilities';

/** Teleporter: moves to any empty matching cell (spec §9). Stub: offers no targets until the full-rules feature. */
export const teleporter: AbilityModule = {
  type: 'Teleporter',
  targets: () => [],
  resolve: () => [],
};
