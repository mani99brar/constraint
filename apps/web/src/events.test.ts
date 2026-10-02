import { describe, expect, it } from 'vitest';
import { projectEvents, type PlayerEvent, type PublicLogEntry, type ResolutionEvent } from '@okiya/rules';
import { describeEvent, describeEvents, orderEvents } from './events';
import { describeLogEntry } from './text';

// Hand-built: traps never trigger in this worktree's engine (PRD R5).
const SWAP_INTO_TRAP: readonly PlayerEvent[] = [
  { kind: 'match-ended', result: { kind: 'win', winner: 'A', reason: 'objective' } },
  { kind: 'constraint-set', constraint: { terrain: 'Water', symbol: 'Moon' } },
  { kind: 'lock-applied', fighter: 'B:Swapper', expiresAfterTurn: 8 },
  { kind: 'charge-lost', fighter: 'A:Pusher' },
  { kind: 'trap-triggered', trapId: 'A-setup-1', owner: 'A', cell: 'B3', fighter: 'B:Swapper' },
  { kind: 'trap-triggered', trapId: 'B-setup-2', owner: 'B', cell: 'B2', fighter: 'A:Pusher' },
  { kind: 'fighter-entered', fighter: 'B:Swapper', from: 'B2', to: 'B3', entry: 'swap' },
  { kind: 'fighter-entered', fighter: 'A:Pusher', from: 'B3', to: 'B2', entry: 'swap' },
  { kind: 'charge-spent', fighter: 'B:Swapper' },
];

describe('resolution feedback order (spec §11, PRD R5)', () => {
  it('shows positions, trap triggers, charge loss or lock, the constraint, then the outcome', () => {
    const kinds = orderEvents(SWAP_INTO_TRAP).map((event) => event.kind);
    expect(kinds).toEqual([
      'charge-spent',
      'fighter-entered',
      'fighter-entered',
      'trap-triggered',
      'trap-triggered',
      'lock-applied',
      'charge-lost',
      'constraint-set',
      'match-ended',
    ]);
  });

  it('keeps the engine order within one step', () => {
    const ordered = orderEvents(SWAP_INTO_TRAP).filter((event) => event.kind === 'fighter-entered');
    expect(ordered.map((event) => (event.kind === 'fighter-entered' ? event.fighter : ''))).toEqual(['B:Swapper', 'A:Pusher']);
  });

  it('describes every step in words', () => {
    expect(describeEvents(SWAP_INTO_TRAP, 'A')).toEqual([
      "Bot's Swapper spent its charge.",
      "Bot's Swapper entered by swap from B2 to B3.",
      'Your Pusher entered by swap from B3 to B2.',
      "Bot's Swapper triggered your trap at B3.",
      "Your Pusher triggered the bot's trap at B2.",
      "Bot's Swapper is locked through turn 8.",
      'Your Pusher lost its charge to the trap.',
      'Constraint is now Water or Moon (Water–Moon).',
      'You win by completing a square.',
    ]);
  });

  it('lists an event kind it does not know by its name', () => {
    const unknown = { kind: 'future-event' } as unknown as PlayerEvent;
    expect(describeEvent(unknown, 'A')).toBe('future event.');
    expect(orderEvents([{ kind: 'constraint-set', constraint: { terrain: 'Water', symbol: 'Sun' } }, unknown])[0]).toBe(unknown);
  });
});

describe('hidden trap placement (PRD I2)', () => {
  const placed: ResolutionEvent[] = [
    { kind: 'charge-spent', fighter: 'B:Trapper' },
    { kind: 'trap-placed', owner: 'B', trapId: 'B-trap-5', cell: 'C2' },
  ];

  it('shows a Trapper placement by the bot without its cell', () => {
    const projected = projectEvents(placed, 'A');
    const entry: PublicLogEntry = { turn: 6, player: 'B', action: { kind: 'ability', fighter: 'B:Trapper', target: null }, events: projected };
    const lines = [describeLogEntry(entry, 'A'), ...describeEvents(projected, 'A')];
    expect(lines).toEqual(['Bot: Trapper placed a trap', "Bot's Trapper spent its charge.", 'Bot placed a trap.']);
    for (const line of lines) expect(line).not.toMatch(/[A-D][1-4]/);
  });

  it('shows the player’s own placement with its cell', () => {
    const own = projectEvents([{ kind: 'trap-placed', owner: 'A', trapId: 'A-trap-5', cell: 'C2' }], 'A');
    expect(describeEvents(own, 'A')).toEqual(['You placed a trap at C2.']);
  });

  it('shows an inspection result only to the inspector', () => {
    const inspected: ResolutionEvent[] = [{ kind: 'traps-inspected', inspector: 'B', actor: 'B:TrapChecker', cell: 'A2', removed: 1 }];
    expect(describeEvents(projectEvents(inspected, 'A'), 'A')).toEqual(["Bot's Trap Checker inspected A2."]);
    expect(describeEvents(projectEvents(inspected, 'B'), 'B')).toEqual(['Your Trap Checker inspected A2: removed 1 enemy trap.']);
  });
});
