import { describe, expect, it } from 'vitest';
import { applyAction, playerView, projectEvents, type MatchState, type ObjectiveId, type ResolutionEvent } from '../api';
import { A, B, construct, gridMatch, play, seededMatch, tile, withTraps } from './testing';

const B_TYPES = ['Swapper', 'Upgrader', 'Puller', 'Trapper'];

describe('per-player view (spec §4)', () => {
  it("never contains the opponent's objective, reserve identities or live trap locations", () => {
    const state = seededMatch(11);
    const view = playerView(state, 'A');
    const json = JSON.stringify(view);
    for (const type of B_TYPES) expect(json).not.toContain(type);
    expect(view.fighters.filter((fighter) => fighter.owner === 'B')).toEqual([]);
    expect(view.reserveCounts).toEqual({ A: 4, B: 4 });
    expect(view.ownTraps.every((trap) => trap.owner === 'A')).toBe(true);
    expect(view.ownTraps.map((trap) => trap.cell)).toEqual(['B2', 'C3']);
    expect(view.objective).toBe('Square');
    expect(view).not.toHaveProperty('objectives');
    expect(view.reveal).toBeUndefined();
  });

  it("does not change when only the opponent's secrets change", () => {
    const state = seededMatch(11);
    const otherSecrets: MatchState = {
      ...state,
      objectives: { A: 'Square', B: 'Square' },
      setups: { ...state.setups, B: { roster: ['Anchor', 'Pusher', 'Puller', 'Trapper'], traps: ['D4', 'A1'] } },
      fighters: state.fighters.map((fighter) =>
        fighter.id === B('Swapper') ? { ...fighter, id: B('Anchor'), type: 'Anchor' } : fighter,
      ),
      traps: state.traps.map((trap) => (trap.owner === 'B' ? { ...trap, cell: trap.cell === 'A3' ? 'D4' : 'A1' } : trap)),
      inspections: [{ turn: 1, inspector: 'B', actor: B('Trapper'), cell: 'B2', removedTrapIds: ['A-setup-1'] }],
    };
    expect(playerView(otherSecrets, 'A')).toEqual(playerView(state, 'A'));
  });

  it('shows a deployed opponent fighter but not the rest of its reserve', () => {
    let state = construct(gridMatch(), {}, { activePlayer: 'B' });
    const applied = applyAction(state, { kind: 'deploy', fighter: B('Puller'), cell: 'A1' });
    if (!applied.ok) throw new Error('deploy refused');
    state = applied.state;
    const view = playerView(state, 'A');
    expect(view.fighters.filter((fighter) => fighter.owner === 'B').map((fighter) => fighter.type)).toEqual(['Puller']);
    expect(view.reserveCounts.B).toBe(3);
    expect(JSON.stringify(view)).not.toContain('Swapper');
  });
});

describe('hidden traps and objectives during play (spec §4)', () => {
  // Mid-play: both sides hold setup traps, B's Trapper has placed one and A's Trap Checker has
  // removed a B trap, so every kind of trap record exists.
  const midPlay = (): MatchState =>
    play(
      withTraps(
        construct(
          gridMatch(),
          { [B('Trapper')]: 'C2', [A('TrapChecker')]: 'C4', [A('Pusher')]: 'A1' },
          { constraint: tile('Mountain', 'Wave'), activePlayer: 'B', turn: 6, objectives: { A: 'Square', B: 'Line' as ObjectiveId } },
        ),
        ['A@D4', 'A@A2', 'B@B4', 'B@D1'],
      ),
      { kind: 'ability', fighter: B('Trapper'), target: 'C1' },
      { kind: 'ability', fighter: A('TrapChecker'), target: 'B4' },
    );

  it("never contains the opponent's live trap cells, trap ids or trap history", () => {
    const state = midPlay();
    expect(state.result).toBeNull();
    const view = playerView(state, 'A');
    expect(view).not.toHaveProperty('trapHistory');
    expect(view.reveal).toBeUndefined();
    const json = JSON.stringify(view);
    expect(json).not.toContain('trapHistory');
    for (const trap of state.traps.filter((live) => live.owner === 'B')) expect(json).not.toContain(trap.id);
    expect(view.ownTraps.every((trap) => trap.owner === 'A')).toBe(true);
    const moved = { ...state, traps: state.traps.map((trap) => (trap.owner === 'B' ? { ...trap, cell: 'A4' as const } : trap)) };
    expect(playerView(moved, 'A')).toEqual(view);
  });

  it("never contains the opponent's objective when the two objectives differ", () => {
    const state = midPlay();
    expect(playerView(state, 'A').objective).toBe('Square');
    expect(JSON.stringify(playerView(state, 'A'))).not.toContain('Line');
    expect(playerView(state, 'B').objective).toBe('Line');
    expect(playerView(state, 'B')).not.toHaveProperty('objectives');
    // The preset's objective pool is public; only A's own assignment is hidden from B.
    expect(JSON.stringify(playerView(state, 'B'))).not.toContain('"objective":"Square"');
  });

  it("keeps listing a trap the opponent removed by inspection, since the result is the inspector's alone", () => {
    const state = midPlay();
    expect(state.traps.some((trap) => trap.owner === 'B' && trap.cell === 'B4')).toBe(false);
    expect(playerView(state, 'B').ownTraps.map((trap) => trap.cell)).toEqual(['B4', 'D1', 'C1']);
    expect(playerView(state, 'B').inspections).toEqual([]);
    expect(playerView(state, 'A').inspections.map((inspection) => inspection.cell)).toEqual(['B4']);
  });
});

describe('public log and events (spec §4; PRD I2, R5)', () => {
  it("applying a deploy returns a constraint-set event and logs the action", () => {
    const applied = applyAction(gridMatch(), { kind: 'deploy', fighter: A('Teleporter'), cell: 'A1' });
    if (!applied.ok) throw new Error('deploy refused');
    expect(applied.events).toContainEqual({ kind: 'constraint-set', constraint: tile('Forest', 'Sun') });
    const log = playerView(applied.state, 'B').log;
    expect(log).toEqual([
      { turn: 1, player: 'A', action: { kind: 'deploy', fighter: A('Teleporter'), cell: 'A1' }, events: applied.events },
    ]);
  });

  it("redacts the cell of the other side's Trapper placement", () => {
    const events: ResolutionEvent[] = [
      { kind: 'charge-spent', fighter: B('Trapper') },
      { kind: 'trap-placed', owner: 'B', trapId: 'B-trap-5', cell: 'C2' },
    ];
    const state: MatchState = {
      ...gridMatch(),
      history: [{ turn: 9, player: 'B', action: { kind: 'ability', fighter: B('Trapper'), target: 'C2' }, events }],
    };
    const [entry] = playerView(state, 'A').log;
    expect(entry?.action).toEqual({ kind: 'ability', fighter: B('Trapper'), target: null });
    expect(entry?.events).toEqual([
      { kind: 'charge-spent', fighter: B('Trapper') },
      { kind: 'trap-placed', owner: 'B', cell: null },
    ]);
    expect(JSON.stringify(entry)).not.toContain('C2');
    const [own] = playerView(state, 'B').log;
    expect(own?.action).toEqual({ kind: 'ability', fighter: B('Trapper'), target: 'C2' });
    expect(own?.events[1]).toEqual({ kind: 'trap-placed', owner: 'B', cell: 'C2' });
  });

  it("projects events per player, hiding the other side's trap cells and inspection results", () => {
    const events: ResolutionEvent[] = [
      { kind: 'trap-placed', owner: 'A', trapId: 'A-trap-5', cell: 'B4' },
      { kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'D2', removed: 1 },
      { kind: 'constraint-set', constraint: tile('Desert', 'Star') },
    ];
    expect(projectEvents(events, 'B')).toEqual([
      { kind: 'trap-placed', owner: 'A', cell: null },
      { kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'D2', removed: null },
      { kind: 'constraint-set', constraint: tile('Desert', 'Star') },
    ]);
    expect(projectEvents(events, 'A')).toEqual([
      { kind: 'trap-placed', owner: 'A', cell: 'B4' },
      { kind: 'traps-inspected', inspector: 'A', actor: A('TrapChecker'), cell: 'D2', removed: 1 },
      { kind: 'constraint-set', constraint: tile('Desert', 'Star') },
    ]);
    expect(JSON.stringify(projectEvents(events, 'B'))).not.toContain('A-trap-5');
  });

  it("keeps only the viewer's own inspection results", () => {
    const state: MatchState = {
      ...gridMatch(),
      inspections: [
        { turn: 3, inspector: 'A', actor: A('TrapChecker'), cell: 'D2', removedTrapIds: ['B-setup-2'] },
        { turn: 4, inspector: 'B', actor: B('Trapper'), cell: 'B2', removedTrapIds: [] },
      ],
    };
    expect(playerView(state, 'A').inspections.map((inspection) => inspection.inspector)).toEqual(['A']);
    expect(playerView(state, 'B').inspections.map((inspection) => inspection.inspector)).toEqual(['B']);
  });
});

describe('end-of-match reveal (PRD R6)', () => {
  it('is absent during play and holds both objectives, rosters and the trap history once the match has ended', () => {
    const state = construct(
      gridMatch(),
      { [A('Teleporter')]: 'A1', [A('Pusher')]: 'A2', [A('TrapChecker')]: 'B1' },
      { constraint: tile('Forest', 'Moon'), turn: 7 },
    );
    expect(playerView(state, 'A').reveal).toBeUndefined();
    expect(playerView(state, 'B').reveal).toBeUndefined();
    const applied = applyAction(state, { kind: 'deploy', fighter: A('TerrainWeaver'), cell: 'B2' });
    if (!applied.ok) throw new Error('deploy refused');
    for (const viewer of ['A', 'B'] as const) {
      const reveal = playerView(applied.state, viewer).reveal;
      expect(reveal?.objectives).toEqual({ A: 'Square', B: 'Square' });
      expect(reveal?.rosters).toEqual({ A: state.setups.A.roster, B: state.setups.B.roster });
      expect(reveal?.trapHistory.map((record) => `${record.owner}@${record.cell}`)).toEqual(['A@B2', 'A@C3', 'B@A3', 'B@D2']);
    }
  });
});
