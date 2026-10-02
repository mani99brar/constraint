import { describe, expect, it } from 'vitest';
import { projectEvents, type PlayerEvent, type PublicLogEntry, type ResolutionEvent } from '@okiya/rules';
import { describeEvent, describeEvents, fighterCells, involvedCells, inspectedOwnTraps, orderEvents, recentAction, trapCallouts } from './events';
import { describeLogEntry } from './text';

// Hand-built: a swap that enters two traps at once (spec §8.3), listed out of order (PRD R5).
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
  it('shows positions, each trap trigger with its own charge loss or lock, the constraint, then the outcome', () => {
    const kinds = orderEvents(SWAP_INTO_TRAP).map((event) => event.kind);
    expect(kinds).toEqual([
      'charge-spent',
      'fighter-entered',
      'fighter-entered',
      'trap-triggered',
      'lock-applied',
      'trap-triggered',
      'charge-lost',
      'constraint-set',
      'match-ended',
    ]);
  });

  it('follows each of two trap triggers in one swap with its own effect (spec §8.3)', () => {
    const ordered = orderEvents(SWAP_INTO_TRAP);
    const pairs = ordered.flatMap((event, index) => {
      if (event.kind !== 'trap-triggered') return [];
      const next = ordered[index + 1]!;
      return [[event.fighter, next.kind, 'fighter' in next ? next.fighter : null]];
    });
    expect(pairs).toEqual([
      ['B:Swapper', 'lock-applied', 'B:Swapper'],
      ['A:Pusher', 'charge-lost', 'A:Pusher'],
    ]);
  });

  it('pairs by fighter even when the engine lists both triggers before both effects', () => {
    const batched: PlayerEvent[] = [
      { kind: 'fighter-entered', fighter: 'A:Swapper', from: 'B2', to: 'B3', entry: 'swap' },
      { kind: 'fighter-entered', fighter: 'B:Pusher', from: 'B3', to: 'B2', entry: 'swap' },
      { kind: 'trap-triggered', trapId: 'B-setup-1', owner: 'B', cell: 'B3', fighter: 'A:Swapper' },
      { kind: 'trap-triggered', trapId: 'A-setup-1', owner: 'A', cell: 'B2', fighter: 'B:Pusher' },
      { kind: 'charge-lost', fighter: 'B:Pusher' },
      { kind: 'lock-applied', fighter: 'A:Swapper', expiresAfterTurn: 5 },
      { kind: 'constraint-set', constraint: { terrain: 'Forest', symbol: 'Sun' } },
    ];
    expect(orderEvents(batched).map((event) => `${event.kind}${'fighter' in event ? ` ${event.fighter}` : ''}`)).toEqual([
      'fighter-entered A:Swapper',
      'fighter-entered B:Pusher',
      'trap-triggered A:Swapper',
      'lock-applied A:Swapper',
      'trap-triggered B:Pusher',
      'charge-lost B:Pusher',
      'constraint-set',
    ]);
    expect(trapCallouts(batched, 'A')).toEqual([
      { cell: 'B3', owner: 'B', text: "Bot's trap! Your Swapper: locked", short: 'Trap: locked' },
      { cell: 'B2', owner: 'A', text: "Your trap! Bot's Pusher: charge lost", short: 'Trap: charge lost' },
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
      "Bot's Swapper is locked through turn 8.",
      "Your Pusher triggered the bot's trap at B2.",
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

describe('action highlights (PRD U6)', () => {
  const fighters = fighterCells([
    { id: 'B:Swapper', owner: 'B', type: 'Swapper', cell: 'B3', charge: 0, lock: { expiresAfterTurn: 8 }, protection: null },
    { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B2', charge: 0, lock: null, protection: null },
    { id: 'A:Anchor', owner: 'A', type: 'Anchor', cell: 'D4', charge: 1, lock: null, protection: null },
    { id: 'B:Trapper', owner: 'B', type: 'Trapper', cell: 'A1', charge: 0, lock: null, protection: null },
  ]);

  it('highlights exactly the cells a swap into two traps involved', () => {
    expect([...involvedCells(SWAP_INTO_TRAP, fighters)].sort()).toEqual(['B2', 'B3']);
  });

  it('highlights a deploy at its cell only', () => {
    const events: PlayerEvent[] = [
      { kind: 'fighter-entered', fighter: 'A:Anchor', from: null, to: 'D4', entry: 'deploy' },
      { kind: 'constraint-set', constraint: { terrain: 'Water', symbol: 'Sun' } },
    ];
    expect([...involvedCells(events, fighters)]).toEqual(['D4']);
  });

  it('highlights the actor, exchanged tiles, inspected cells and a hidden placement only at the actor', () => {
    expect([...involvedCells([{ kind: 'charge-spent', fighter: 'B:Trapper' }, { kind: 'trap-placed', owner: 'B', cell: null }], fighters)]).toEqual(['A1']);
    expect(
      [
        ...involvedCells(
          [
            { kind: 'charge-spent', fighter: 'A:Anchor' },
            { kind: 'terrain-exchanged', cells: ['D4', 'C4'] },
          ],
          fighters,
        ),
      ].sort(),
    ).toEqual(['C4', 'D4']);
    expect(
      [...involvedCells([{ kind: 'traps-inspected', inspector: 'B', actor: 'B:TrapChecker', cell: 'C1', removed: null }], fighters)],
    ).toEqual(['C1']);
    expect([...involvedCells([{ kind: 'protection-applied', fighter: 'A:Pusher', expiresAfterTurn: 4 }], fighters)]).toEqual(['B2']);
  });

  it('describes the last action of the log, and none before the first', () => {
    const entry: PublicLogEntry = { turn: 7, player: 'B', action: { kind: 'ability', fighter: 'B:Swapper', target: 'B2' }, events: SWAP_INTO_TRAP };
    const fighterList = [
      { id: 'B:Swapper', owner: 'B', type: 'Swapper', cell: 'B3', charge: 0, lock: null, protection: null },
      { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B2', charge: 0, lock: null, protection: null },
    ] as const;
    const recent = recentAction({ log: [entry], fighters: fighterList }, 'A')!;
    expect(recent.turn).toBe(7);
    expect(recent.player).toBe('B');
    expect([...recent.cells].sort()).toEqual(['B2', 'B3']);
    expect(recent.callouts.map((callout) => callout.cell)).toEqual(['B3', 'B2']);
    expect(recentAction({ log: [], fighters: fighterList }, 'A')).toBeNull();
  });
});

describe('own traps the bot inspected (spec §9)', () => {
  const inspect = (turn: number, cell: 'B2' | 'C3'): PublicLogEntry => ({
    turn,
    player: 'B',
    action: { kind: 'ability', fighter: 'B:TrapChecker', target: cell },
    events: [{ kind: 'traps-inspected', inspector: 'B', actor: 'B:TrapChecker', cell, removed: null }],
  });
  const ownTraps = [
    { id: 'A-setup-1', owner: 'A', cell: 'B2' },
    { id: 'A-trap-6', owner: 'A', cell: 'C3' },
  ] as const;
  const placeAtC3: PublicLogEntry = {
    turn: 6,
    player: 'A',
    action: { kind: 'ability', fighter: 'A:Trapper', target: 'C3' },
    events: [{ kind: 'trap-placed', owner: 'A', cell: 'C3' }],
  };

  it('marks an own trap inspected after it was set, and not one set after the inspection', () => {
    expect([...inspectedOwnTraps({ log: [inspect(4, 'B2'), inspect(5, 'C3'), placeAtC3], ownTraps }, 'A')]).toEqual(['B2']);
    expect([...inspectedOwnTraps({ log: [placeAtC3, inspect(7, 'C3')], ownTraps }, 'A')]).toEqual(['C3']);
  });
});
