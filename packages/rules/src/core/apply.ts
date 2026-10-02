import type { Board, CellId, Constraint } from '../api/board';
import type { Action, ApplyResult } from '../api/actions';
import type { ConstraintRule, Effect } from '../api/abilities';
import { opponentOf, type FighterId, type PlayerId } from '../api/fighters';
import type { ResolutionEvent } from '../api/events';
import type { FighterState, InspectionRecord, LiveTrap, MatchState, TrapId, TrapRecord } from '../api/state';
import { ABILITY_MODULES } from '../abilities/registry';
import { abilityContext, validateAction } from './legality';
import { findFighter } from './queries';
import { canonicalSignature } from './signature';
import { blockadeResult, objectiveResult, repetitionResult } from './terminal';

/** A fighter that entered a cell during one action, in order; traps resolve against these. */
interface Entry {
  readonly fighter: FighterId;
  readonly cell: CellId;
}

interface Resolution {
  state: MatchState;
  events: ResolutionEvent[];
  entries: Entry[];
  constraintRule: ConstraintRule;
}

function updateFighter(state: MatchState, id: FighterId, change: Partial<FighterState>): MatchState {
  return { ...state, fighters: state.fighters.map((fighter) => (fighter.id === id ? { ...fighter, ...change } : fighter)) };
}

/** The effects of an action: deploy and move are built here, abilities come from their module. */
function effectsOf(state: MatchState, action: Action, actor: FighterState): readonly Effect[] {
  switch (action.kind) {
    case 'deploy':
      return [
        { kind: 'relocate', fighter: actor.id, to: action.cell, entry: 'deploy' },
        { kind: 'constraint', rule: { kind: 'tile-at', cell: action.cell } },
      ];
    case 'move':
      return [
        { kind: 'relocate', fighter: actor.id, to: action.cell, entry: 'move' },
        { kind: 'constraint', rule: { kind: 'tile-at', cell: action.cell } },
      ];
    case 'recharge':
      return [
        { kind: 'restore-charge', fighter: actor.id },
        { kind: 'constraint', rule: { kind: 'tile-under', fighter: actor.id } },
      ];
    case 'ability':
      return ABILITY_MODULES[actor.type].resolve(abilityContext(state, actor), action.target);
  }
}

/** Applies effects in order (spec §11 step 4). Relocations of one action happen together. */
function applyEffects(resolution: Resolution, effects: readonly Effect[], actor: FighterState): Resolution {
  let { state } = resolution;
  const events = [...resolution.events];
  const entries = [...resolution.entries];
  let { constraintRule } = resolution;
  for (const effect of effects) {
    switch (effect.kind) {
      case 'relocate': {
        const from = findFighter(state, effect.fighter)?.cell ?? null;
        state = updateFighter(state, effect.fighter, { cell: effect.to });
        entries.push({ fighter: effect.fighter, cell: effect.to });
        events.push({ kind: 'fighter-entered', fighter: effect.fighter, from, to: effect.to, entry: effect.entry });
        break;
      }
      case 'exchange-terrain': {
        const [a, b] = effect.cells;
        const board: Board = { ...state.board, [a]: state.board[b], [b]: state.board[a] };
        state = { ...state, board };
        events.push({ kind: 'terrain-exchanged', cells: effect.cells });
        break;
      }
      case 'place-trap': {
        const trap: LiveTrap = { id: newTrapId(state, effect.owner), owner: effect.owner, cell: effect.cell };
        const record: TrapRecord = {
          ...trap,
          source: 'trapper',
          placedOnTurn: state.turn,
          placedBy: actor.id,
          fate: { kind: 'live' },
        };
        state = { ...state, traps: [...state.traps, trap], trapHistory: [...state.trapHistory, record] };
        events.push({ kind: 'trap-placed', owner: effect.owner, trapId: trap.id, cell: effect.cell });
        break;
      }
      case 'remove-enemy-traps': {
        const removed = state.traps.filter((trap) => trap.cell === effect.cell && trap.owner !== effect.inspector);
        const removedIds = new Set(removed.map((trap) => trap.id));
        const inspection: InspectionRecord = {
          turn: state.turn,
          inspector: effect.inspector,
          actor: actor.id,
          cell: effect.cell,
          removedTrapIds: [...removedIds],
        };
        state = {
          ...state,
          traps: state.traps.filter((trap) => !removedIds.has(trap.id)),
          trapHistory: state.trapHistory.map((record) =>
            removedIds.has(record.id) ? { ...record, fate: { kind: 'removed', turn: state.turn, by: actor.id } } : record,
          ),
          inspections: [...state.inspections, inspection],
        };
        events.push({ kind: 'traps-inspected', inspector: effect.inspector, actor: actor.id, cell: effect.cell, removed: removed.length });
        break;
      }
      case 'protect': {
        const extra = state.preset.variants.anchorProtection === 'through-owner-following-turn' ? 2 : 1;
        const expiresAfterTurn = state.turn + extra;
        state = updateFighter(state, effect.fighter, { protection: { expiresAfterTurn, by: actor.id } });
        events.push({ kind: 'protection-applied', fighter: effect.fighter, expiresAfterTurn });
        break;
      }
      case 'restore-charge':
        state = updateFighter(state, effect.fighter, { charge: 1 });
        events.push({ kind: 'charge-restored', fighter: effect.fighter });
        break;
      case 'constraint':
        constraintRule = effect.rule;
        break;
    }
  }
  return { state, events, entries, constraintRule };
}

/**
 * A trap id no live or recorded trap uses. It is named after the placing turn, which is public,
 * and stays unique in a hypothetical state that holds only one side's traps.
 */
function newTrapId(state: MatchState, owner: PlayerId): TrapId {
  const taken = new Set([...state.traps, ...state.trapHistory].map((trap) => trap.id));
  let id = `${owner}-trap-${state.turn}`;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${owner}-trap-${state.turn}-${suffix}`;
  return id;
}

/**
 * The turn a new lock expires after (spec §8.2): the fighter misses `lockOwnTurnsMissed` of its
 * owner's turns. Triggered on the owner's turn T, the first missed turn is T + 2; triggered on
 * the opponent's turn T, it is T + 1. Turns alternate, so each further missed turn adds two.
 */
function lockExpiry(state: MatchState, owner: PlayerId): number {
  const firstMissed = owner === state.activePlayer ? state.turn + 2 : state.turn + 1;
  return firstMissed + 2 * (state.preset.lockOwnTurnsMissed - 1);
}

/**
 * Resolves enemy traps for every fighter that entered a cell, after all positions are applied
 * (spec §8, §11 step 5). Own traps stay dormant and hidden. Each triggered trap is revealed and
 * removed, then takes the entrant's charge, or locks it when it has none; a second lock extends
 * to the later expiry rather than stacking.
 */
function resolveTraps(resolution: Resolution, opening: boolean): Resolution {
  if (opening && !resolution.state.preset.trapsTriggerOnOpening) return resolution;
  let { state } = resolution;
  const events = [...resolution.events];
  for (const entry of resolution.entries) {
    const owner = findFighter(state, entry.fighter)!.owner;
    for (const trap of state.traps.filter((live) => live.cell === entry.cell && live.owner !== owner)) {
      state = {
        ...state,
        traps: state.traps.filter((live) => live.id !== trap.id),
        trapHistory: state.trapHistory.map((record) =>
          record.id === trap.id ? { ...record, fate: { kind: 'triggered', turn: state.turn, fighter: entry.fighter } } : record,
        ),
      };
      events.push({ kind: 'trap-triggered', trapId: trap.id, owner: trap.owner, cell: trap.cell, fighter: entry.fighter });
      const fighter = findFighter(state, entry.fighter)!;
      if (fighter.charge === 1) {
        state = updateFighter(state, fighter.id, { charge: 0 });
        events.push({ kind: 'charge-lost', fighter: fighter.id });
      } else {
        const expiresAfterTurn = Math.max(lockExpiry(state, fighter.owner), fighter.lock?.expiresAfterTurn ?? 0);
        state = updateFighter(state, fighter.id, { lock: { expiresAfterTurn } });
        events.push({ kind: 'lock-applied', fighter: fighter.id, expiresAfterTurn });
      }
    }
  }
  return { ...resolution, state, events };
}

function nextConstraint(state: MatchState, rule: ConstraintRule): Constraint | null {
  switch (rule.kind) {
    case 'tile-at':
      return state.board[rule.cell];
    case 'tile-under': {
      const cell = findFighter(state, rule.fighter)?.cell;
      return cell ? state.board[cell] : state.constraint;
    }
    case 'unchanged':
      return state.constraint;
  }
}

/** Expires locks and protection scheduled for the end of this turn (spec §11 step 8). */
function expireStatuses(state: MatchState): MatchState {
  return {
    ...state,
    fighters: state.fighters.map((fighter) => ({
      ...fighter,
      lock: fighter.lock && fighter.lock.expiresAfterTurn <= state.turn ? null : fighter.lock,
      protection: fighter.protection && fighter.protection.expiresAfterTurn <= state.turn ? null : fighter.protection,
    })),
  };
}

/**
 * Applies one action of the active player (spec §11). Returns the next state and the ordered
 * resolution events, or a structured refusal with the state untouched.
 */
export function applyAction(state: MatchState, action: Action): ApplyResult {
  const refusal = validateAction(state, action);
  if (refusal) return { ok: false, refusal };
  const actor = findFighter(state, action.fighter)!;
  const player = state.activePlayer;

  // Spend the action's costs (spec §11 step 3).
  let resolution: Resolution = { state, events: [], entries: [], constraintRule: { kind: 'unchanged' } };
  if (action.kind === 'ability') {
    resolution.state = updateFighter(resolution.state, actor.id, { charge: 0 });
    resolution.events.push({ kind: 'charge-spent', fighter: actor.id });
  } else if (action.kind === 'recharge') {
    const remaining = state.recharges[player] - 1;
    resolution.state = { ...resolution.state, recharges: { ...state.recharges, [player]: remaining } };
    resolution.events.push({ kind: 'recharge-spent', player, remaining });
  }

  resolution = applyEffects(resolution, effectsOf(state, action, actor), actor);
  resolution = resolveTraps(resolution, state.constraint === null);

  let next = resolution.state;
  const events = resolution.events;
  const constraint = nextConstraint(next, resolution.constraintRule);
  next = { ...next, constraint };
  if (constraint && resolution.constraintRule.kind !== 'unchanged') events.push({ kind: 'constraint-set', constraint });

  // Terminal checks in spec §11 order: objectives (step 7), then, once the turn has passed,
  // the next player's blockade (step 10), then the repetition draw (step 11, spec §12).
  let result = objectiveResult(next);
  if (!result) {
    next = expireStatuses(next);
    next = { ...next, turn: next.turn + 1, activePlayer: opponentOf(player) };
    result = blockadeResult(next);
  }
  if (!result) {
    next = { ...next, repetition: [...next.repetition, canonicalSignature(next)] };
    result = repetitionResult(next);
  }
  if (result) events.push({ kind: 'match-ended', result });

  next = {
    ...next,
    result,
    history: [...next.history, { turn: state.turn, player, action, events }],
  };
  return { ok: true, state: next, events };
}
