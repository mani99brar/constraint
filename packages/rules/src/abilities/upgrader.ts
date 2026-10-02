import type { AbilityModule } from '../api/abilities';

/** Upgrader: transfers its charge to an adjacent spent ally (spec §9). Stub: offers no targets until the full-rules feature. */
export const upgrader: AbilityModule = {
  type: 'Upgrader',
  targets: () => [],
  resolve: () => [],
};
