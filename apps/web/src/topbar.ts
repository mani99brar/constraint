import type { ObjectiveId, PlayerId, PlayerView, Terrain, TileSymbol } from '@okiya/rules';
import { objectiveName } from './howto';
import { constraintText, describeResult } from './text';

/** One half of the constraint as the top bar draws it: an emblem with its name (PRD T4, U1). */
export type ConstraintEmblem =
  | { readonly kind: 'terrain'; readonly terrain: Terrain; readonly name: string }
  | { readonly kind: 'symbol'; readonly symbol: TileSymbol; readonly name: string };

/** One side's shared recharge actions as pips: `true` for each one still left. */
export interface RechargePips {
  readonly player: PlayerId;
  readonly side: 'You' | 'Bot';
  readonly left: number;
  readonly total: number;
  readonly pips: readonly boolean[];
  readonly label: string;
}

/** Everything the slim top bar shows (PRD T4, U5). */
export interface TopBarModel {
  /** "Your turn", "Bot is thinking", or the result once the match has ended. */
  readonly turnText: string;
  readonly humanTurn: boolean;
  readonly botThinking: boolean;
  /** Terrain then symbol; null before the opening deployment, which has no constraint. */
  readonly constraint: readonly [ConstraintEmblem, ConstraintEmblem] | null;
  /** The constraint in words, for screen readers and the opening, for example "Forest or Moon". */
  readonly constraintLabel: string;
  /** Yours first, then the bot's. */
  readonly recharges: readonly [RechargePips, RechargePips];
  readonly goal: { readonly objective: ObjectiveId; readonly label: string };
}

export const OPENING_LABEL = 'Opening: any edge cell';

function pips(view: PlayerView, player: PlayerId, human: PlayerId): RechargePips {
  const total = Math.max(view.preset.rechargesPerPlayer, view.recharges[player]);
  const left = view.recharges[player];
  const side = player === human ? 'You' : 'Bot';
  const whose = player === human ? 'Your' : "Bot's";
  return {
    player,
    side,
    left,
    total,
    pips: Array.from({ length: total }, (_, index) => index < left),
    label: `${whose} recharges: ${left} of ${total} left`,
  };
}

export function topBarModel(view: PlayerView, human: PlayerId): TopBarModel {
  const bot: PlayerId = human === 'A' ? 'B' : 'A';
  const over = view.result !== null;
  const humanTurn = !over && view.activePlayer === human;
  const { constraint } = view;
  return {
    turnText: view.result ? describeResult(view.result, human) : humanTurn ? 'Your turn' : 'Bot is thinking',
    humanTurn,
    botThinking: !over && !humanTurn,
    constraint: constraint
      ? [
          { kind: 'terrain', terrain: constraint.terrain, name: constraint.terrain },
          { kind: 'symbol', symbol: constraint.symbol, name: constraint.symbol },
        ]
      : null,
    constraintLabel: constraint ? `Constraint: ${constraintText(constraint)}` : OPENING_LABEL,
    recharges: [pips(view, human, human), pips(view, bot, human)],
    goal: { objective: view.objective, label: `Goal: ${objectiveName(view.objective)}` },
  };
}
