import type { AbilityModule } from '../api/abilities';

/** Terrain Weaver: exchanges its tile with an adjacent tile (spec §9). Stub: offers no targets until the full-rules feature. */
export const terrainWeaver: AbilityModule = {
  type: 'TerrainWeaver',
  targets: () => [],
  resolve: () => [],
};
