import type { AbilityModule } from '../api/abilities';

/** Pusher: pushes an adjacent matching fighter one cell away (spec §9). Stub: offers no targets until the full-rules feature. */
export const pusher: AbilityModule = {
  type: 'Pusher',
  targets: () => [],
  resolve: () => [],
};
