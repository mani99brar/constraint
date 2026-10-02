import { SYMBOLS, TERRAINS, type Tile } from '@okiya/rules';

/** The 16 tiles: exactly one for every terrain/symbol pair (spec §3). */
export const TILES: readonly Tile[] = TERRAINS.flatMap((terrain) => SYMBOLS.map((symbol) => ({ terrain, symbol })));
