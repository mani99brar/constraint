import { FIGHTERS } from '@okiya/content';
import type { ActionRefusal, Constraint, FighterId, FighterType, MatchResult, PlayerId, PublicLogEntry, Tile } from '@okiya/rules';

const SYMBOL_ICONS: Record<Tile['symbol'], string> = { Sun: '☀', Moon: '☾', Star: '★', Wave: '≈' };

export function symbolIcon(symbol: Tile['symbol']): string {
  return SYMBOL_ICONS[symbol];
}

export function tileName(tile: Tile): string {
  return `${tile.terrain}–${tile.symbol}`;
}

export function constraintText(constraint: Constraint): string {
  return `${constraint.terrain} or ${constraint.symbol}`;
}

export function fighterName(type: FighterType): string {
  return FIGHTERS.find((fighter) => fighter.type === type)?.name ?? type;
}

export function fighterIdName(id: FighterId | string): string {
  const type = id.slice(id.indexOf(':') + 1) as FighterType;
  return fighterName(type);
}

export function sideName(player: PlayerId, human: PlayerId): string {
  return player === human ? 'You' : 'Bot';
}

/** Readable reason for a structured refusal (PRD R4). */
export function describeRefusal(refusal: ActionRefusal): string {
  switch (refusal.code) {
    case 'match-over':
      return 'The match is over.';
    case 'not-your-fighter':
      return 'That is not one of your fighters.';
    case 'unknown-cell':
      return `${refusal.cell} is not a cell of the board.`;
    case 'not-in-reserve':
      return `${fighterIdName(refusal.fighter)} is already deployed.`;
    case 'not-deployed':
      return `${fighterIdName(refusal.fighter)} is still in reserve.`;
    case 'opening-must-deploy':
      return 'The opening action must deploy a fighter.';
    case 'not-edge-cell':
      return `${refusal.cell} is not on the outside edge; the opening deployment must be.`;
    case 'cell-occupied':
      return `${refusal.cell} is occupied.`;
    case 'no-match':
      return `${tileName(refusal.tile)} does not match ${constraintText(refusal.constraint)}.`;
    case 'not-adjacent':
      return `${refusal.to} is not one orthogonal step from ${refusal.from}.`;
    case 'fighter-locked':
      return `${fighterIdName(refusal.fighter)} is locked.`;
    case 'no-charge':
      return `${fighterIdName(refusal.fighter)} has no charge.`;
    case 'already-charged':
      return `${fighterIdName(refusal.fighter)} is already charged.`;
    case 'no-recharges-left':
      return 'No recharge actions are left.';
    case 'invalid-target':
      return `${refusal.target} is not a legal target for ${fighterIdName(refusal.fighter)}.`;
  }
}

/** One public log line in spec notation (PRD I2). */
export function describeLogEntry(entry: PublicLogEntry, human: PlayerId): string {
  const who = sideName(entry.player, human);
  const { action } = entry;
  switch (action.kind) {
    case 'deploy':
      return `${who}: deploy ${fighterIdName(action.fighter)} at ${action.cell}`;
    case 'move':
      return `${who}: move ${fighterIdName(action.fighter)} to ${action.cell}`;
    case 'recharge':
      return `${who}: recharge ${fighterIdName(action.fighter)}`;
    case 'ability':
      return action.target === null
        ? `${who}: ${fighterIdName(action.fighter)} placed a trap`
        : `${who}: ${fighterIdName(action.fighter)} ability on ${action.target}`;
  }
}

export function describeResult(result: MatchResult, human: PlayerId): string {
  if (result.kind === 'draw') {
    return result.reason === 'repetition' ? 'Draw by repetition.' : 'Draw: both squares completed at once.';
  }
  const winner = result.winner === human ? 'You win' : 'The bot wins';
  return result.reason === 'objective' ? `${winner} by completing a square.` : `${winner}: the other side has no legal action.`;
}
