// Test fixtures on the paper test 01 board (`docs/paper-test-01.md`): its 28 recorded actions and
// a builder for constructed positions. Test-only; not exported from the package.

import {
  applyAction,
  canonicalSignature,
  prepareMatch,
  startMatch,
  type Action,
  type CellId,
  type FighterId,
  type FighterState,
  type FighterType,
  type MatchState,
  type PlayerId,
  type Preset,
  type Tile,
  type TrapRecord,
  SYMBOLS,
  TERRAINS,
} from '@okiya/rules';
import { defaultSetup, FIGHTERS, PAPER_TEST_01, SPEC_V0_2, TILES } from './index';

/** The doc's tile notation: `F-Su` is Forest–Sun. */
export function parseTile(text: string): Tile {
  const [terrain, symbol] = text.split('-');
  const t = TERRAINS.find((value) => value[0] === terrain);
  const s = SYMBOLS.find((value) => value.startsWith(symbol ?? '?'));
  if (!t || !s || symbol?.length !== 2) throw new Error(`Unreadable tile ${text}`);
  return { terrain: t, symbol: s };
}

/** The doc's fighter notation: `A:TC` is A's Trap Checker. */
export function fid(text: string): FighterId {
  const [owner, abbreviation] = text.split(':');
  const type = FIGHTERS.find((fighter) => fighter.abbreviation === abbreviation)?.type;
  if ((owner !== 'A' && owner !== 'B') || !type) throw new Error(`Unreadable fighter ${text}`);
  return `${owner}:${type}`;
}

const deploy = (fighter: string, cell: CellId): Action => ({ kind: 'deploy', fighter: fid(fighter), cell });
const move = (fighter: string, cell: CellId): Action => ({ kind: 'move', fighter: fid(fighter), cell });
const recharge = (fighter: string): Action => ({ kind: 'recharge', fighter: fid(fighter) });
const ability = (fighter: string, target: CellId): Action => ({ kind: 'ability', fighter: fid(fighter), target });

/** The 28 recorded actions of the Phase A ledger, T1–T28. */
export const LEDGER: readonly Action[] = [
  deploy('A:TP', 'A1'),
  deploy('B:SW', 'B2'),
  deploy('A:PU', 'D3'),
  deploy('B:UP', 'A3'),
  deploy('A:TW', 'C2'),
  deploy('B:TR', 'B3'),
  move('A:TP', 'A2'),
  deploy('B:PL', 'C3'),
  deploy('A:TC', 'D1'),
  recharge('B:PL'),
  ability('A:TC', 'D2'),
  move('B:UP', 'A4'),
  move('A:PU', 'D2'),
  move('B:SW', 'B1'),
  move('A:TP', 'A3'),
  recharge('B:SW'),
  recharge('A:TP'),
  move('B:PL', 'C4'),
  move('A:TW', 'C3'),
  ability('B:TR', 'B2'),
  recharge('A:TC'),
  move('B:PL', 'B4'),
  ability('A:TP', 'C2'),
  move('B:TR', 'A3'),
  move('A:PU', 'D3'),
  move('B:SW', 'B2'),
  ability('A:PU', 'C3'),
  ability('B:SW', 'B3'),
];

/** The paper test 01 match at its start, under preset spec-v0.2 (or a variant of it). */
export function startPaperTest01(preset: Preset = SPEC_V0_2): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset, seed: 1, scenario: PAPER_TEST_01 });
  // The scenario overrides both rosters and trap sets, whatever the sides chose.
  return startMatch(prepared, { A: defaultSetup('B'), B: defaultSetup('A') });
}

/** The match after its first `count` ledger actions: `replayTo(10)` is the state before T11. */
export function replayTo(count: number): MatchState {
  let state = startPaperTest01();
  for (const action of LEDGER.slice(0, count)) state = must(applyAction(state, action)).state;
  return state;
}

/** The applied result of a legal action; throws with the refusal otherwise. */
export function must(applied: ReturnType<typeof applyAction>): Extract<ReturnType<typeof applyAction>, { ok: true }> {
  if (!applied.ok) throw new Error(`Refused: ${JSON.stringify(applied.refusal)}`);
  return applied;
}

/** Applies legal actions in order and returns the final state. */
export function play(state: MatchState, ...actions: Action[]): MatchState {
  for (const action of actions) state = must(applyAction(state, action)).state;
  return state;
}

export interface PositionSpec {
  readonly active: PlayerId;
  readonly turn: number;
  /** `D-St`, or null before the opening. */
  readonly constraint: string | null;
  /**
   * Deployed fighters by notation, for example `{ 'A:TC': 'D1 0 L31' }`: the cell, then optional
   * `0` for charge 0, `L<turn>` for a lock and `P<turn>` for protection expiring after that turn.
   * Unlisted fighters stay in reserve, charged.
   */
  readonly fighters: Readonly<Record<string, string>>;
  readonly rosters?: Partial<Record<PlayerId, readonly FighterType[]>>;
  /** Live traps as `owner@cell`, for example `B@C1`. */
  readonly traps?: readonly string[];
  readonly recharges?: Readonly<Record<PlayerId, number>>;
  readonly preset?: Preset;
}

/**
 * A constructed position on the fixture board: rosters from the fixture unless given, the listed
 * fighters placed with their charge and statuses, the listed traps live, and the position
 * registered once for repetition.
 */
export function position(spec: PositionSpec): MatchState {
  const preset = spec.preset ?? SPEC_V0_2;
  const prepared = prepareMatch({ tiles: TILES, preset, seed: 1, scenario: PAPER_TEST_01 });
  const rosters = { ...PAPER_TEST_01.rosters, ...spec.rosters };
  const base = startMatch(prepared, { A: defaultSetup('A'), B: defaultSetup('B') }, {
    id: 'position',
    name: 'Constructed position',
    rosters: { A: rosters.A!, B: rosters.B! },
  });
  const placed = new Map(Object.entries(spec.fighters).map(([key, value]) => [fid(key), value]));
  for (const id of placed.keys()) {
    if (!base.fighters.some((fighter) => fighter.id === id)) throw new Error(`${id} is not on a roster`);
  }
  const fighters = base.fighters.map((fighter): FighterState => {
    const value = placed.get(fighter.id);
    if (value === undefined) return fighter;
    const [cell, ...marks] = value.split(' ');
    const lock = marks.find((mark) => mark.startsWith('L'));
    const protection = marks.find((mark) => mark.startsWith('P'));
    return {
      ...fighter,
      cell: cell as CellId,
      charge: marks.includes('0') ? 0 : 1,
      lock: lock ? { expiresAfterTurn: Number(lock.slice(1)) } : null,
      protection: protection ? { expiresAfterTurn: Number(protection.slice(1)), by: fighter.id } : null,
    };
  });
  const trapHistory: TrapRecord[] = (spec.traps ?? []).map((text, index) => {
    const [owner, cell] = text.split('@') as [PlayerId, CellId];
    return { id: `${owner}-setup-${index + 1}`, owner, cell, source: 'setup', placedOnTurn: 0, placedBy: null, fate: { kind: 'live' } };
  });
  const state: MatchState = {
    ...base,
    fighters,
    traps: trapHistory.map(({ id, owner, cell }) => ({ id, owner, cell })),
    trapHistory,
    constraint: spec.constraint === null ? null : parseTile(spec.constraint),
    activePlayer: spec.active,
    turn: spec.turn,
    recharges: spec.recharges ?? base.recharges,
  };
  return { ...state, repetition: [canonicalSignature(state)] };
}

export function fighter(state: MatchState, notation: string): FighterState {
  return state.fighters.find((candidate) => candidate.id === fid(notation))!;
}
