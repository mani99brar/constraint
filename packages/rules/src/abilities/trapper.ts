import type { AbilityModule } from '../api/abilities';

/** Trapper: secretly places a trap on an adjacent empty or allied cell (spec §9). Stub: offers no targets until the full-rules feature. */
export const trapper: AbilityModule = {
  type: 'Trapper',
  targets: () => [],
  resolve: () => [],
};
