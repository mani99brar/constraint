import type { AbilityModule } from '../api/abilities';
import type { FighterType } from '../api/fighters';
import { anchor } from './anchor';
import { puller } from './puller';
import { pusher } from './pusher';
import { swapper } from './swapper';
import { teleporter } from './teleporter';
import { terrainWeaver } from './terrain-weaver';
import { trapChecker } from './trap-checker';
import { trapper } from './trapper';
import { upgrader } from './upgrader';

/** One ability module per fighter type, behind the shared `AbilityModule` contract. */
export const ABILITY_MODULES: Readonly<Record<FighterType, AbilityModule>> = {
  Teleporter: teleporter,
  Pusher: pusher,
  Swapper: swapper,
  Upgrader: upgrader,
  TrapChecker: trapChecker,
  Puller: puller,
  Anchor: anchor,
  TerrainWeaver: terrainWeaver,
  Trapper: trapper,
};
