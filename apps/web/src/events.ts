import type { PlayerEvent, PlayerId } from '@okiya/rules';
import { constraintText, describeResult, fighterLabel, sideName, tileName } from './text';

/**
 * The step of spec §11 an event belongs to: costs, positions and other effects, trap triggers,
 * charge loss or lock, the new constraint, then the outcome (PRD R5). Unknown kinds count as effects.
 */
function step(event: PlayerEvent): number {
  switch (event.kind) {
    case 'charge-spent':
    case 'recharge-spent':
      return 0;
    case 'trap-triggered':
      return 2;
    case 'charge-lost':
    case 'lock-applied':
      return 3;
    case 'constraint-set':
      return 4;
    case 'match-ended':
      return 5;
    default:
      return 1;
  }
}

/** Projected events in spec §11 order; events of the same step keep the engine's order. */
export function orderEvents(events: readonly PlayerEvent[]): PlayerEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => step(a.event) - step(b.event) || a.index - b.index)
    .map(({ event }) => event);
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
