import { FIGHTERS } from '@okiya/content';
import type {
  ActionRefusal,
  Constraint,
  FighterId,
  FighterType,
  MatchResult,
  PlayerId,
  SetupRefusal,
  Tile,
  TrapRecord,
} from '@okiya/rules';

export function tileName(tile: Tile): string {
  return `${tile.terrain}–${tile.symbol}`;
}

export function constraintText(constraint: Constraint): string {
  return `${constraint.terrain} or ${constraint.symbol}`;
}

export function fighterName(type: FighterType | string): string {
  return FIGHTERS.find((fighter) => fighter.type === type)?.name ?? type;
}

/** A fighter's help text: its `summary` in `@okiya/content` (spec §9). */
export function fighterHelp(type: FighterType | string): string {
  return FIGHTERS.find((fighter) => fighter.type === type)?.summary ?? '';
}

/** The fighter's short code on its token, for example "PU". */
export function fighterAbbreviation(type: FighterType | string): string {
  return FIGHTERS.find((fighter) => fighter.type === type)?.abbreviation ?? type.slice(0, 2).toUpperCase();
}

export function fighterIdName(id: FighterId | string): string {
  return fighterName(id.slice(id.indexOf(':') + 1));
}

function ownerOf(id: FighterId | string): string {
  return id.slice(0, id.indexOf(':'));
}

export function sideName(player: PlayerId, human: PlayerId): string {
  return player === human ? 'You' : 'Bot';
}

/** A fighter inside a sentence: "your Pusher" or "bot's Swapper". */
export function fighterPhrase(id: FighterId | string, human: PlayerId): string {
  return `${ownerOf(id) === human ? 'your' : "bot's"} ${fighterIdName(id)}`;
}

/** A fighter at the start of a sentence: "Your Pusher" or "Bot's Swapper". */
export function fighterLabel(id: FighterId | string, human: PlayerId): string {
  const phrase = fighterPhrase(id, human);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Readable reason for a structured action refusal (PRD R4). */
export function describeRefusal(refusal: ActionRefusal): string {
  switch (refusal.code) {
    case 'match-over':
      return 'The match is over.';
    case 'unknown-action':
      return `The action "${refusal.kind}" is not part of this game.`;
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
    default:
      return `That action is not allowed (${(refusal as { code: string }).code}).`;
  }
}

/** Readable reason for a structured setup refusal (PRD R4). */
export function describeSetupRefusal(refusal: SetupRefusal): string {
  switch (refusal.code) {
    case 'roster-size':
      return `A roster has exactly ${refusal.expected} fighters; this one has ${refusal.actual}.`;
    case 'unknown-fighter':
      return `${refusal.fighter} is not a fighter of the pool.`;
    case 'fighters-not-distinct':
      return `${fighterName(refusal.fighter)} is already in your roster; fighters must be distinct.`;
    case 'displacer-limit':
      return `At most ${refusal.limit} displacers (Pusher, Puller, Swapper) are allowed; this roster has ${refusal.actual}.`;
    case 'trap-count':
      return `Place exactly ${refusal.expected} setup traps; there are ${refusal.actual}.`;
    case 'unknown-cell':
      return `${refusal.cell} is not a cell of the board.`;
    case 'trap-cells-not-distinct':
      return `${refusal.cell} already holds one of your traps; setup traps go on distinct cells.`;
    default:
      return `That setup is not allowed (${(refusal as { code: string }).code}).`;
  }
}

export function describeResult(result: MatchResult, human: PlayerId): string {
  if (result.kind === 'draw') {
    return result.reason === 'repetition' ? 'Draw by repetition.' : 'Draw: both squares completed at once.';
  }
  const winner = result.winner === human ? 'You win' : 'The bot wins';
  return result.reason === 'objective' ? `${winner} by completing a square.` : `${winner}: the other side has no legal action.`;
}

/** Where a trap came from and what became of it, for the end screen (PRD R6). */
export function describeTrap(trap: TrapRecord, human: PlayerId): string {
  const owner = trap.owner === human ? 'Your' : "Bot's";
  const source = trap.source === 'setup' ? 'setup trap' : `trap placed on turn ${trap.placedOnTurn}`;
  let fate: string;
  switch (trap.fate.kind) {
    case 'live':
      fate = 'never triggered';
      break;
    case 'triggered':
      fate = `triggered on turn ${trap.fate.turn} by ${fighterPhrase(trap.fate.fighter, human)}`;
      break;
    case 'removed':
      fate = `removed on turn ${trap.fate.turn} by ${fighterPhrase(trap.fate.by, human)}`;
      break;
  }
  return `${owner} ${source} at ${trap.cell}: ${fate}`;
}
