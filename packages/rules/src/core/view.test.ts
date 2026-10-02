import { describe, expect, it } from 'vitest';
import { applyAction, playerView, projectEvents, type MatchState, type ResolutionEvent } from '../api';
import { A, B, construct, gridMatch, seededMatch, tile } from './testing';

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
