import type { CellId, FighterId, FighterState, PlayerEvent, PlayerId, PlayerView } from '@okiya/rules';
import { constraintText, describeResult, fighterLabel, sideName, tileName } from './text';

/**
 * The step of spec §11 an event belongs to: costs, positions and other effects, trap triggers
 * with their charge loss or lock, the new constraint, then the outcome (PRD R5). Unknown kinds
 * count as effects.
 */
function step(event: PlayerEvent): number {
  switch (event.kind) {
    case 'charge-spent':
    case 'recharge-spent':
      return 0;
    case 'trap-triggered':
    case 'charge-lost':
    case 'lock-applied':
      return 2;
    case 'constraint-set':
      return 3;
    case 'match-ended':
      return 4;
    default:
      return 1;
  }
}

function trapEffectOf(event: PlayerEvent): FighterId | null {
  return event.kind === 'charge-lost' || event.kind === 'lock-applied' ? event.fighter : null;
}

/**
 * Projected events in spec §11 order; events of the same step keep the engine's order, except
 * that each trap trigger is followed by its own charge loss or lock, the first one of the same
 * fighter, so two trap entries in one swap (spec §8.3) read as two pairs.
 */
export function orderEvents(events: readonly PlayerEvent[]): PlayerEvent[] {
  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => step(a.event) - step(b.event) || a.index - b.index)
    .map(({ event }) => event);
  const effects = sorted.filter((event) => trapEffectOf(event) !== null);
  const paired = new Set<PlayerEvent>();
  const result: PlayerEvent[] = [];
  for (const event of sorted) {
    if (trapEffectOf(event) !== null) continue;
    result.push(event);
    if (event.kind !== 'trap-triggered') continue;
    const effect = effects.find((candidate) => !paired.has(candidate) && trapEffectOf(candidate) === event.fighter);
    if (effect) {
      paired.add(effect);
      result.push(effect);
    }
  }
  // A charge loss or lock without a trigger stays in its step, before the constraint.
  const unpaired = effects.filter((effect) => !paired.has(effect));
  const at = result.findIndex((event) => step(event) > 2);
  result.splice(at === -1 ? result.length : at, 0, ...unpaired);
  return result;
}

/** Where a fighter stands now, if it is on the board. */
export type FighterCells = ReadonlyMap<FighterId, CellId>;

export function fighterCells(fighters: readonly FighterState[]): FighterCells {
  return new Map(fighters.flatMap((fighter) => (fighter.cell ? [[fighter.id, fighter.cell] as const] : [])));
}

/**
 * The cells one action involved, from its events only (PRD U6): every cell a fighter left or
 * entered, exchanged tiles, inspected cells, visible trap cells, and the cell of every fighter an
 * event names (the actor spending its charge, a recharged, protected, drained or locked fighter).
 */
export function involvedCells(events: readonly PlayerEvent[], fighters: FighterCells): Set<CellId> {
  const cells = new Set<CellId>();
  const add = (cell: CellId | null | undefined) => {
    if (cell) cells.add(cell);
  };
  for (const event of events) {
    switch (event.kind) {
      case 'fighter-entered':
        add(event.from);
        add(event.to);
        break;
      case 'terrain-exchanged':
        add(event.cells[0]);
        add(event.cells[1]);
        break;
      case 'traps-inspected':
      case 'trap-triggered':
        add(event.cell);
        break;
      case 'trap-placed':
        add(event.cell);
        break;
      case 'charge-spent':
      case 'charge-restored':
      case 'protection-applied':
      case 'charge-lost':
      case 'lock-applied':
        add(fighters.get(event.fighter));
        break;
      default:
        break;
    }
  }
  return cells;
}

/** A trap trigger called out on its cell (PRD U6), with what the trap did. */
export interface TrapCallout {
  readonly cell: CellId;
  readonly owner: PlayerId;
  /** The full sentence, for example "Your trap! Bot's Swapper: locked". */
  readonly text: string;
  /** The label on the cell, for example "Trap: locked". */
  readonly short: string;
}

export function trapCallouts(events: readonly PlayerEvent[], human: PlayerId): TrapCallout[] {
  const ordered = orderEvents(events);
  return ordered.flatMap((event, index) => {
    if (event.kind !== 'trap-triggered') return [];
    const next = ordered[index + 1];
    const effect =
      next?.kind === 'charge-lost' && next.fighter === event.fighter
        ? 'charge lost'
        : next?.kind === 'lock-applied' && next.fighter === event.fighter
          ? 'locked'
          : 'sprung';
    const whose = event.owner === human ? 'Your trap' : "Bot's trap";
    return [{ cell: event.cell, owner: event.owner, text: `${whose}! ${fighterLabel(event.fighter, human)}: ${effect}`, short: `Trap: ${effect}` }];
  });
}

/** The most recent action as the board shows it: who acted, the cells involved and trap callouts. */
export interface RecentAction {
  readonly turn: number;
  readonly player: PlayerId;
  readonly cells: ReadonlySet<CellId>;
  readonly callouts: readonly TrapCallout[];
}

export function recentAction(view: Pick<PlayerView, 'log' | 'fighters'>, human: PlayerId): RecentAction | null {
  const entry = view.log[view.log.length - 1];
  if (!entry) return null;
  return {
    turn: entry.turn,
    player: entry.player,
    cells: involvedCells(entry.events, fighterCells(view.fighters)),
    callouts: trapCallouts(entry.events, human),
  };
}

/**
 * Own trap cells the other side's Trap Checker inspected after the trap was set. Only the
 * inspector learns the result (spec §9), so the trap stays shown, marked as maybe removed.
 */
export function inspectedOwnTraps(view: Pick<PlayerView, 'log' | 'ownTraps'>, human: PlayerId): Set<CellId> {
  const placedOn = new Map<CellId, number>();
  const inspectedOn = new Map<CellId, number>();
  for (const entry of view.log) {
    for (const event of entry.events) {
      if (event.kind === 'trap-placed' && event.owner === human && event.cell) placedOn.set(event.cell, entry.turn);
      if (event.kind === 'traps-inspected' && event.inspector !== human) inspectedOn.set(event.cell, entry.turn);
    }
  }
  const cells = new Set<CellId>();
  for (const trap of view.ownTraps) {
    const inspected = inspectedOn.get(trap.cell);
    if (inspected !== undefined && inspected > (placedOn.get(trap.cell) ?? 0)) cells.add(trap.cell);
  }
  return cells;
}

/** One line of resolution feedback. A trap the viewer does not own is shown without its cell (PRD I2). */
export function describeEvent(event: PlayerEvent, human: PlayerId): string {
  switch (event.kind) {
    case 'fighter-entered':
      return event.from
        ? `${fighterLabel(event.fighter, human)} ${event.entry === 'move' ? 'moved' : `entered by ${event.entry}`} from ${event.from} to ${event.to}.`
        : `${fighterLabel(event.fighter, human)} deployed at ${event.to}.`;
    case 'charge-spent':
      return `${fighterLabel(event.fighter, human)} spent its charge.`;
    case 'recharge-spent':
      return `${sideName(event.player, human)} spent a recharge action (${event.remaining} left).`;
    case 'charge-restored':
      return `${fighterLabel(event.fighter, human)} is charged again.`;
    case 'terrain-exchanged':
      return `Terrain exchanged between ${event.cells[0]} and ${event.cells[1]}.`;
    case 'protection-applied':
      return `${fighterLabel(event.fighter, human)} is protected through turn ${event.expiresAfterTurn}.`;
    case 'trap-placed':
      return event.cell === null ? `${sideName(event.owner, human)} placed a trap.` : `${sideName(event.owner, human)} placed a trap at ${event.cell}.`;
    case 'traps-inspected':
      return event.removed === null
        ? `${fighterLabel(event.actor, human)} inspected ${event.cell}.`
        : `${fighterLabel(event.actor, human)} inspected ${event.cell}: ${event.removed === 0 ? 'no trap found' : `removed ${event.removed} enemy trap${event.removed === 1 ? '' : 's'}`}.`;
    case 'trap-triggered':
      return `${fighterLabel(event.fighter, human)} triggered ${event.owner === human ? 'your' : "the bot's"} trap at ${event.cell}.`;
    case 'charge-lost':
      return `${fighterLabel(event.fighter, human)} lost its charge to the trap.`;
    case 'lock-applied':
      return `${fighterLabel(event.fighter, human)} is locked through turn ${event.expiresAfterTurn}.`;
    case 'constraint-set':
      return `Constraint is now ${constraintText(event.constraint)} (${tileName(event.constraint)}).`;
    case 'match-ended':
      return describeResult(event.result, human);
    default:
      // An event kind this client does not know yet is still listed, by its name.
      return `${(event as { kind: string }).kind.replaceAll('-', ' ')}.`;
  }
}

/** The resolution feedback of one action: its projected events, ordered and described. */
export function describeEvents(events: readonly PlayerEvent[], human: PlayerId): string[] {
  return orderEvents(events).map((event) => describeEvent(event, human));
}
