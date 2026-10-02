import type { CellId } from './board';
import type { FighterId, FighterType, PlayerId } from './fighters';
import type { Preset } from './preset';
import type { FighterState, MatchState } from './state';

/** How a fighter entered a cell; every mode can trigger an enemy trap (spec §8.1). */
export type EntryMode = 'deploy' | 'move' | 'teleport' | 'push' | 'pull' | 'swap';

/** How the action sets the next constraint (spec §6, §9). */
export type ConstraintRule =
  /** The tile at this cell after all effects are applied. */
  | { readonly kind: 'tile-at'; readonly cell: CellId }
  /** The tile beneath this fighter after all effects are applied (Terrain Weaver). */
  | { readonly kind: 'tile-under'; readonly fighter: FighterId }
  /** Keep the current constraint (Trapper). */
  | { readonly kind: 'unchanged' };

/**
 * What an ability does, as data. Fighter modules return effects; `src/core/` applies them in
 * order, then resolves traps for every relocated fighter, locks and the win check.
 * Relocations of one action happen together, so a swap is two `relocate` effects.
 */
export type Effect =
  | { readonly kind: 'relocate'; readonly fighter: FighterId; readonly to: CellId; readonly entry: EntryMode }
  | { readonly kind: 'exchange-terrain'; readonly cells: readonly [CellId, CellId] }
  | { readonly kind: 'place-trap'; readonly owner: PlayerId; readonly cell: CellId }
  /** Remove the enemy traps in a cell; core records the private inspection result. */
  | { readonly kind: 'remove-enemy-traps'; readonly inspector: PlayerId; readonly cell: CellId }
  /** Protect a fighter; core computes the expiry from the preset's Anchor variant. */
  | { readonly kind: 'protect'; readonly fighter: FighterId }
  | { readonly kind: 'restore-charge'; readonly fighter: FighterId }
  | { readonly kind: 'constraint'; readonly rule: ConstraintRule };

export interface AbilityContext {
  readonly state: MatchState;
  readonly actor: FighterState;
  /** The match's preset, including its variant switches. */
  readonly preset: Preset;
}

/**
 * One fighter's ability (spec §9). `targets` lists the legal target cells for the actor, given
 * that the actor is deployed, unlocked and charged; `resolve` returns the effects of activating it
 * on one of those targets. Core spends the charge before applying the effects (spec §7.4).
 */
export interface AbilityModule {
  readonly type: FighterType;
  targets(context: AbilityContext): readonly CellId[];
  resolve(context: AbilityContext, target: CellId): readonly Effect[];
}
