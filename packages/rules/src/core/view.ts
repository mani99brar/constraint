import type { PlayerId } from '../api/fighters';
import type { PlayerEvent, ResolutionEvent } from '../api/events';
import type { HistoryEntry, LiveTrap, MatchState } from '../api/state';
import type { PlayerView, PublicAction, PublicLogEntry } from '../api/view';
import { fighterTypeOf } from './queries';

/** Projects the referee's events for one player, hiding the other side's trap cells and inspection results. */
export function projectEvents(events: readonly ResolutionEvent[], viewer: PlayerId): PlayerEvent[] {
  return events.map((event): PlayerEvent => {
    switch (event.kind) {
      case 'trap-placed':
        return { kind: 'trap-placed', owner: event.owner, cell: event.owner === viewer ? event.cell : null };
      case 'traps-inspected':
        return { ...event, removed: event.inspector === viewer ? event.removed : null };
      default:
        return event;
    }
  });
}

/** A Trapper's target cell is hidden from the other side (spec §4, PRD I2). */
function publicAction(entry: HistoryEntry, viewer: PlayerId): PublicAction {
  const { action } = entry;
  if (action.kind === 'ability' && entry.player !== viewer && fighterTypeOf(action.fighter) === 'Trapper') {
    return { kind: 'ability', fighter: action.fighter, target: null };
  }
  return action;
}

export function projectLogEntry(entry: HistoryEntry, viewer: PlayerId): PublicLogEntry {
  return {
    turn: entry.turn,
    player: entry.player,
    action: publicAction(entry, viewer),
    events: projectEvents(entry.events, viewer),
  };
}

function countBy(state: MatchState, deployed: boolean): Record<PlayerId, number> {
  const counts = { A: 0, B: 0 };
  for (const fighter of state.fighters) if ((fighter.cell !== null) === deployed) counts[fighter.owner] += 1;
  return counts;
}

/**
 * The viewer's traps as the viewer knows them: a trigger is public, but an enemy Trap Checker's
 * removal is private to the inspector (spec §4, §9), so a trap removed that way still shows.
 */
function ownTrapsAsKnown(state: MatchState, viewer: PlayerId): LiveTrap[] {
  return state.trapHistory
    .filter((record) => record.owner === viewer && record.fate.kind !== 'triggered')
    .map((record) => ({ id: record.id, owner: record.owner, cell: record.cell }));
}

/** What one player may know of the match (spec §4); the only state the client renders. */
export function playerView(state: MatchState, viewer: PlayerId): PlayerView {
  const view: PlayerView = {
    viewer,
    seed: state.seed,
    turn: state.turn,
    activePlayer: state.activePlayer,
    startingPlayer: state.startingPlayer,
    preset: state.preset,
    board: state.board,
    constraint: state.constraint,
    fighters: state.fighters.filter((fighter) => fighter.owner === viewer || fighter.cell !== null),
    reserveCounts: countBy(state, false),
    deployedCounts: countBy(state, true),
    recharges: state.recharges,
    objective: state.objectives[viewer],
    ownTraps: ownTrapsAsKnown(state, viewer),
    log: state.history.map((entry) => projectLogEntry(entry, viewer)),
    inspections: state.inspections.filter((inspection) => inspection.inspector === viewer),
    result: state.result,
  };
  if (!state.result) return view;
  return {
    ...view,
    reveal: {
      objectives: state.objectives,
      rosters: { A: state.setups.A.roster, B: state.setups.B.roster },
      trapHistory: state.trapHistory,
    },
  };
}
