import type { AbilityModule } from '../api/abilities';

/** Trap Checker: inspects one adjacent empty or enemy cell and removes enemy traps there (spec §9). Stub: offers no targets until the full-rules feature. */
export const trapChecker: AbilityModule = {
  type: 'TrapChecker',
  targets: () => [],
  resolve: () => [],
};
