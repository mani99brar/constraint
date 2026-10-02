import { describe, expect, it } from 'vitest';
import { chooseAction, chooseSetup, DEFAULT_BUDGET, DEFAULT_MAX_DEPTH, type SearchOptions, type SearchStats } from '@okiya/bot';
import { DEFAULT_ROSTERS, PAPER_TEST_01, SPEC_V0_2, TILES } from '@okiya/content';
import {
  ALL_CELLS,
  applyAction,
  canonicalSignature,
  listLegalActions,
  matchLogOf,
  objectiveResult,
  parseMatchLog,
  playerView,
  prepareMatch,
  replayMatchSteps,
  startMatch,
  validateSetup,
  type Action,
  type Board,
  type CellId,
  type FighterId,
  type FighterType,
  type MatchState,
  type PlayerId,
  type Scenario,
} from '@okiya/rules';

// Every assertion is an outcome computed through the public API:
// - Setup traps sit on cells no action of the test enters, or only their owner's fighters enter.
// - In the first hand-built positions both rosters are Upgrader, Trap Checker, Anchor and
//   Trapper. None of their abilities moves a fighter, so no ability can complete or block a
//   square, and each one's next constraint is its actor's tile or unchanged (spec §9).
// - The paper test 01 F1 positions give the human a Puller and a Swapper; the tie-break
//   positions use the default rosters, abilities included.

const BOT: PlayerId = 'B';
const HUMAN: PlayerId = 'A';

/** Rows are terrains (A Forest, B Water, C Mountain, D Desert), columns symbols (Sun, Moon, Star, Wave). */
const GRID_BOARD = Object.fromEntries(ALL_CELLS.map((cell, index) => [cell, TILES[index]!])) as Board;
const STILL_ROSTER: readonly FighterType[] = ['Upgrader', 'TrapChecker', 'Anchor', 'Trapper'];

function gridScenario(
  startingPlayer: PlayerId,
  traps: Record<PlayerId, readonly CellId[]>,
  rosters: Record<PlayerId, readonly FighterType[]> = { A: STILL_ROSTER, B: STILL_ROSTER },
): Scenario {
  return { id: 'bot-test', name: 'Bot test', board: GRID_BOARD, rosters, traps, startingPlayer };
}

function apply(state: MatchState, action: Action): MatchState {
  const applied = applyAction(state, action);
  if (!applied.ok) throw new Error(`refused ${JSON.stringify(action)}: ${JSON.stringify(applied.refusal)}`);
  return applied.state;
}

function stepAction(step: string): Action {
  if (step.endsWith('+')) return { kind: 'recharge', fighter: step.slice(0, -1) as FighterId };
  const [fighter, kind, cell] = step.split(/([@>!])/) as [FighterId, '@' | '>' | '!', CellId];
  if (kind === '!') return { kind: 'ability', fighter, target: cell };
  return { kind: kind === '@' ? 'deploy' : 'move', fighter, cell };
}

/**
 * Plays `A:Trapper@C1` as a deploy, `A:Trapper>C2` as a move, `A:Trapper!C3` as an ability on
 * C3 and `A:Trapper+` as a recharge, from a fresh match. The scenario fixes the board and the
 * starting player, so the seed changes only the bot's generator.
 */
function play(scenario: Scenario, steps: readonly string[], seed = 1): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed, scenario });
  const unused = { roster: [], traps: [] };
  let state = startMatch(prepared, { A: unused, B: unused });
  for (const step of steps) state = apply(state, stepAction(step));
  return state;
}

/** Cells some fighter entered, as the events of the played steps record them. */
function enteredCells(state: MatchState): Map<CellId, Set<PlayerId>> {
  const cells = new Map<CellId, Set<PlayerId>>();
  for (const entry of state.history) {
    for (const event of entry.events) {
      if (event.kind !== 'fighter-entered') continue;
      const owner = state.fighters.find((fighter) => fighter.id === event.fighter)!.owner;
      cells.set(event.to, new Set([...(cells.get(event.to) ?? []), owner]));
    }
  }
  return cells;
}

function wins(state: MatchState, player: PlayerId): boolean {
  const result = objectiveResult(state);
  return result?.kind === 'win' && result.winner === player;
}

/** The active player's actions that complete its square at once. */
function winningActions(state: MatchState): Action[] {
  const player = state.activePlayer;
  return state.result ? [] : listLegalActions(state).filter((action) => wins(apply(state, action), player));
}

/** Whether the active player has an action that completes its square at once. */
function hasImmediateWin(state: MatchState): boolean {
  return winningActions(state).length > 0;
}

const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** Whether some reply of the active player leaves the other side with no legal action. */
function canBlockade(state: MatchState): boolean {
  return listLegalActions(state).some((action) => apply(state, action).result?.reason === 'blockade');
}

function botChoice(state: MatchState, options?: SearchOptions): { action: Action; next: MatchState } {
  const legal = listLegalActions(state);
  const action = chooseAction(playerView(state, state.activePlayer), legal, options);
  expect(legal).toContainEqual(action);
  return { action, next: apply(state, action) };
}

/** The bot's choice and what its search did. */
function botSearch(state: MatchState, options: SearchOptions = {}, legal = listLegalActions(state)): { action: Action; stats: SearchStats } {
  let stats: SearchStats | undefined;
  const action = chooseAction(playerView(state, state.activePlayer), legal, { ...options, onStats: (reported) => (stats = reported) });
  expect(stats).toBeDefined();
  return { action, stats: stats! };
}

function botMatch(seed: number): MatchState {
  const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
  const input = { board: prepared.board, preset: SPEC_V0_2, privateSeed: seed };
  return startMatch(prepared, { A: chooseSetup({ ...input, privateSeed: seed + 1 }), B: chooseSetup(input) });
}

// The bot (B) has A3, A4, B3 and C4 around the open hole B4; the constraint Desert–Wave lets
// C4 walk into B4. Abilities only add choices, and the assertion holds for any winning one.
const WIN_STEPS = ['B:Upgrader@A4', 'A:Trapper@A2', 'B:Anchor@A3', 'A:Anchor@D3', 'B:Trapper@B3', 'A:TrapChecker@C3', 'B:TrapChecker@C4', 'A:Upgrader@D4'];
const WIN_TRAPS = { A: ['A1', 'D1'], B: ['B1', 'D2'] } as const;

// The human (A) holds A3, B2 and B3 around the open hole A2, with A1 next to it, and the
// constraint Water–Moon matches A2. Most bot actions hand over a constraint matching A2;
// deploying into A2 holds it (paper test 01 F2). The human's abilities move no fighter, so
// its only wins are walks into the hole, whatever the rules lane adds.
const THREAT_STEPS = ['A:Trapper@A3', 'B:TrapChecker@A4', 'A:Upgrader@A1', 'B:Trapper@B1', 'A:TrapChecker@B3', 'B:TrapChecker>B4', 'A:Anchor@B2'];
const THREAT_TRAPS = { A: ['D3', 'D4'], B: ['D1', 'D2'] } as const;

// The human holds A1, A2 and B1 around the open hole B2 (Water–Moon), with B3 next to it. No
// bot fighter can reach B2, so the bot can only choose which constraint to hand over: C4 to
// B4 hands over Water–Wave, which lets B3 walk into B2; the other moves hand over Mountain–Star.
const HANDOVER_STEPS = [
  'A:Upgrader@A2', 'B:Anchor@A3', 'A:Anchor@A1', 'B:Trapper@D1', 'A:TrapChecker@B1', 'B:Trapper>C1',
  'A:Trapper@C2', 'B:TrapChecker@C4', 'A:Trapper>C3', 'B:Upgrader@D3', 'A:Trapper>B3',
];
const HANDOVER_TRAPS = { A: ['A4', 'D4'], B: ['D2', 'D4'] } as const;

// The bot's Upgrader is still in reserve and the constraint is Water–Sun. Deploying it on D1
// lets the human walk B1 to C1 and hand over Mountain–Sun: then only the Upgrader's tile
// matches, it is charged (no recharge), no ally of it lacks a charge (no Upgrader target),
// and no bot fighter has an empty matching neighbour, so the bot has no legal action with or
// without abilities. Other choices keep a matching empty cell next to a bot fighter for every
// reply, ability replies included: they hand over the actor's tile, which matches the
// constraint the bot handed over, or keep it.
const BLOCKADE_STEPS = [
  'A:Upgrader@D3', 'B:Anchor@A3', 'A:Anchor@A2', 'B:TrapChecker@D2', 'A:Upgrader>D4', 'B:TrapChecker>D3',
  'A:TrapChecker@C3', 'B:Trapper@B3', 'A:Trapper@B1',
];
const BLOCKADE_TRAPS = { A: ['C2', 'C4'], B: ['A4', 'B4'] } as const;

// A midgame on the paper test 01 board and rosters, every fighter deployed, A to move.
const MIDGAME_STEPS = [
  'A:TrapChecker@B1', 'B:Trapper@A3', 'A:Teleporter@D3', 'B:Swapper@C4', 'A:Pusher@B3', 'B:Upgrader@D4',
  'A:TerrainWeaver@A4', 'B:Puller@D1',
];
const MIDGAME_SCENARIO: Scenario = { ...PAPER_TEST_01, traps: { A: ['C2', 'D2'], B: ['A1', 'B2'] } };
// Three moves on, B to move, every fighter still deployed and charged: wide enough that the
// position budget stops depth 5 before it completes.
const BUDGET_STEPS = [...MIDGAME_STEPS, 'A:Teleporter>C3', 'B:Trapper>A2', 'A:TrapChecker>C1'];

// Paper test 01 F1: the human (A) has a Puller and a Swapper, the bot (B) the still roster.
// PULL: A holds B1, C1 and C2 around the open hole B2, and its Puller on C2 can pull its
// Upgrader from A2 into B2; the Upgrader cannot walk in on the constraints that allow the pull.
// SWAP: A holds B4, C3 and C4, the bot's Trap Checker blocks B3, and A's Swapper on A3 can
// swap with it. Many bot actions hand over a constraint that lets A complete by pull or swap.
const F1_ROSTERS = { A: ['Puller', 'Swapper', 'Upgrader', 'Anchor'], B: STILL_ROSTER } as const;
const F1_TRAPS = { A: ['D3', 'D4'], B: ['D1', 'D2'] } as const;
const PULL_STEPS = [
  'A:Anchor@B1', 'B:Trapper@B3', 'A:Upgrader@A3', 'B:Upgrader@A2', 'A:Puller@C2', 'B:Trapper>C3', 'A:Swapper@C1',
  'B:Upgrader>A1', 'A:Upgrader>A2',
];
const SWAP_STEPS = ['A:Swapper@A3', 'B:Trapper@A4', 'A:Anchor@C4', 'B:Upgrader@C2', 'A:Upgrader@C3', 'B:TrapChecker@B3', 'A:Puller@B4'];

// Tie-break positions, from seeded random play with the default rosters, B to move. In TIE a
// Trapper placement and a Puller pull of an ally into a cell nobody has entered score the same;
// in AHEAD such a pull scores two actions of mobility (0.1) above every other action.
const TIE_STEPS = [
  'A:TrapChecker@C1', 'B:Upgrader@C4', 'A:Pusher@C3', 'B:Puller@A3', 'A:TerrainWeaver@A2', 'B:Puller>A4', 'A:Teleporter@A3',
  'B:Swapper@A1', 'A:TerrainWeaver!A3', 'B:Swapper!A2', 'A:TerrainWeaver+', 'B:Trapper@B1', 'A:TerrainWeaver!A2', 'B:Swapper+',
  'A:TrapChecker!C2',
];
const AHEAD_STEPS = [
  'A:Teleporter@C1', 'B:Puller@C2', 'A:TerrainWeaver@C3', 'B:Upgrader@A3', 'A:Pusher@A4', 'B:Upgrader>A2', 'A:TrapChecker@A3',
  'B:Trapper@A1', 'A:TrapChecker!A2', 'B:Trapper!A2', 'A:Teleporter!D3', 'B:Swapper@B3', 'A:Pusher>B4', 'B:Swapper!B4',
  'A:TrapChecker>A4',
];
const TIE_BREAK_TRAPS = { A: ['D3', 'D4'], B: ['D1', 'D2'] } as const;
const tieBreakScenario = () => gridScenario('A', TIE_BREAK_TRAPS, DEFAULT_ROSTERS);

/** Seeds for the positions above; a bot choosing at random among legal actions fails some. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('bot test positions', () => {
  it('keep every setup trap off the cells their actions enter, except its owner entering it', () => {
    const cases = [
      [gridScenario('B', WIN_TRAPS), WIN_STEPS],
      [gridScenario('A', THREAT_TRAPS), THREAT_STEPS],
      [gridScenario('A', HANDOVER_TRAPS), HANDOVER_STEPS],
      [gridScenario('A', BLOCKADE_TRAPS), BLOCKADE_STEPS],
      [MIDGAME_SCENARIO, BUDGET_STEPS],
      [gridScenario('A', F1_TRAPS, F1_ROSTERS), PULL_STEPS],
      [gridScenario('A', F1_TRAPS, F1_ROSTERS), SWAP_STEPS],
      [tieBreakScenario(), TIE_STEPS],
      [tieBreakScenario(), AHEAD_STEPS],
    ] as const;
    for (const [scenario, steps] of cases) {
      const state = play(scenario, steps);
      const entered = enteredCells(state);
      for (const player of ['A', 'B'] as const) {
        for (const cell of scenario.traps![player]!) expect([...(entered.get(cell) ?? [])].every((owner) => owner === player)).toBe(true);
      }
      expect(state.history.flatMap((entry) => entry.events).some((event) => event.kind === 'trap-triggered')).toBe(false);
    }
  });
});

describe('bot setup choice', () => {
  it('returns a setup the validator accepts under spec-v0.2', () => {
    for (const seed of [0, 1, 17, 123456]) {
      const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed });
      const setup = chooseSetup({ board: prepared.board, preset: SPEC_V0_2, privateSeed: seed });
      expect(validateSetup(setup, SPEC_V0_2)).toEqual([]);
    }
  });

  it("respects a preset's displacer limit of 1", () => {
    const preset = { ...SPEC_V0_2, variants: { ...SPEC_V0_2.variants, displacerLimit: 1 } };
    for (const seed of [3, 4, 5]) {
      const prepared = prepareMatch({ tiles: TILES, preset, seed });
      expect(validateSetup(chooseSetup({ board: prepared.board, preset, privateSeed: seed }), preset)).toEqual([]);
    }
  });

  it('gives the same setup for the same input', () => {
    const prepared = prepareMatch({ tiles: TILES, preset: SPEC_V0_2, seed: 9 });
    const input = { board: prepared.board, preset: SPEC_V0_2, privateSeed: 4242 };
    expect(chooseSetup(input)).toEqual(chooseSetup(structuredClone(input)));
  });
});

describe('bot action choice', () => {
  // Full bot-against-bot games; the generous timeout covers slower turns once abilities exist.
  it('only ever returns an action from the legal-action list', { timeout: 60_000 }, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let state = botMatch(seed);
      for (let turn = 0; turn < 40 && !state.result; turn += 1) {
        state = botChoice(state).next;
      }
    }
  });

  it('gives the same action for the same view and legal-action list', () => {
    for (const state of [botMatch(77), play(MIDGAME_SCENARIO, MIDGAME_STEPS), play(gridScenario('A', HANDOVER_TRAPS), HANDOVER_STEPS)]) {
      const view = playerView(state, state.activePlayer);
      const legal = listLegalActions(state);
      expect(chooseAction(view, legal)).toEqual(chooseAction(structuredClone(view), structuredClone(legal)));
    }
  });

  it('takes an available immediate Square win', () => {
    for (const seed of SEEDS) {
      const state = play(gridScenario('B', WIN_TRAPS), WIN_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      expect(hasImmediateWin(state)).toBe(true);
      // Not every action wins, so the bot has to find a winning one.
      expect(listLegalActions(state).some((action) => !wins(apply(state, action), BOT))).toBe(true);
      expect(wins(botChoice(state).next, BOT)).toBe(true);
    }
  });

  it("prevents the human's threatened square when a legal action can (paper test 01 F2)", () => {
    for (const seed of SEEDS) {
      const state = play(gridScenario('A', THREAT_TRAPS), THREAT_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      const outcomes = listLegalActions(state).map((action) => hasImmediateWin(apply(state, action)));
      expect(outcomes).toContain(true);
      expect(outcomes).toContain(false);
      for (const options of [undefined, { maxDepth: 2 }]) {
        expect(hasImmediateWin(botChoice(state, options).next)).toBe(false);
      }
    }
  });

  it('does not hand over a constraint that gives the human an immediate win', () => {
    for (const seed of SEEDS) {
      const state = play(gridScenario('A', HANDOVER_TRAPS), HANDOVER_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      const outcomes = listLegalActions(state).map((action) => hasImmediateWin(apply(state, action)));
      expect(outcomes).toContain(true);
      expect(outcomes.filter((humanWins) => !humanWins).length).toBeGreaterThan(1);
      expect(hasImmediateWin(botChoice(state).next)).toBe(false);
    }
  });

  it('prefers an action that leaves it a legal action next turn over blockading itself', () => {
    for (const seed of SEEDS) {
      const state = play(gridScenario('A', BLOCKADE_TRAPS), BLOCKADE_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      const outcomes = listLegalActions(state).map((action) => canBlockade(apply(state, action)));
      expect(outcomes).toContain(true);
      expect(outcomes).toContain(false);
      const { next } = botChoice(state);
      expect(next.result).toBeNull();
      expect(canBlockade(next)).toBe(false);
    }
  });

  it('honours the maximum depth and the position budget', () => {
    const state = play(gridScenario('A', THREAT_TRAPS), THREAT_STEPS);
    for (const options of [{ maxDepth: 1 }, { maxDepth: 2 }, { budget: 1 }, { maxDepth: 5, budget: 1 }, { maxDepth: 0 }]) {
      botChoice(state, options);
    }
  });

  it("prevents the human's square by pull or swap (paper test 01 F1)", () => {
    const modes = [
      [PULL_STEPS, 'A:Puller'],
      [SWAP_STEPS, 'A:Swapper'],
    ] as const;
    for (const [steps, displacer] of modes) {
      for (const seed of SEEDS) {
        const state = play(gridScenario('A', F1_TRAPS, F1_ROSTERS), steps, seed);
        expect(state.activePlayer).toBe(BOT);
        const replies = listLegalActions(state).map((action) => winningActions(apply(state, action)));
        // Some bot actions leave the human a win by the displacer's ability alone, with no walk-in.
        const byDisplacer = (win: Action) => win.kind === 'ability' && win.fighter === displacer;
        expect(replies.some((wins) => wins.length > 0 && wins.every(byDisplacer))).toBe(true);
        expect(replies.some((wins) => wins.length === 0)).toBe(true);
        for (const options of [undefined, { maxDepth: 3 }]) {
          expect(hasImmediateWin(botChoice(state, options).next)).toBe(false);
        }
      }
    }
  });

  it('enters an unscouted cell only to break a tie: it prefers a scouted action of equal score', () => {
    for (const seed of SEEDS) {
      const state = play(tieBreakScenario(), TIE_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      const { action, stats } = botSearch(state);
      const top = stats.roots[0]!.score;
      const tied = stats.roots.filter((root) => root.score >= top - 1e-9);
      expect(tied.some((root) => root.unscouted)).toBe(true);
      expect(tied.some((root) => !root.unscouted)).toBe(true);
      const chosen = stats.roots.find((root) => sameAction(root.action, action))!;
      expect(chosen.score).toBe(top);
      expect(chosen.unscouted).toBe(false);
    }
  });

  it('enters an unscouted cell when that scores better, even by only two actions of mobility', () => {
    for (const seed of SEEDS) {
      const state = play(tieBreakScenario(), AHEAD_STEPS, seed);
      expect(state.activePlayer).toBe(BOT);
      const { action, stats } = botSearch(state);
      const chosen = stats.roots.find((root) => sameAction(root.action, action))!;
      expect(chosen.unscouted).toBe(true);
      expect(chosen.score).toBe(stats.roots[0]!.score);
      // The best scouted action's exact score: the search over the scouted actions alone.
      const scouted = stats.roots.filter((root) => !root.unscouted).map((root) => root.action);
      const best = botSearch(state, {}, scouted).stats.roots[0]!.score;
      expect(chosen.score - best).toBeGreaterThan(0);
      expect(chosen.score - best).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('completes depth 2 within the default budget on a midgame with abilities, and runs out of budget at depth 5', () => {
    for (const state of [play(MIDGAME_SCENARIO, MIDGAME_STEPS), play(MIDGAME_SCENARIO, BUDGET_STEPS)]) {
      expect(listLegalActions(state).some((action) => action.kind === 'ability')).toBe(true);
      const { stats } = botSearch(state);
      expect(DEFAULT_MAX_DEPTH).toBe(2);
      expect(stats).toMatchObject({ completedDepth: 2, budgetExhausted: false });
      expect(stats.positions).toBeLessThan(DEFAULT_BUDGET);
    }
    const wide = play(MIDGAME_SCENARIO, BUDGET_STEPS);
    const deep = botSearch(wide, { maxDepth: 5 }).stats;
    expect(deep.budgetExhausted).toBe(true);
    expect(deep.positions).toBe(DEFAULT_BUDGET);
    expect(deep.completedDepth).toBeGreaterThanOrEqual(2);
    expect(deep.completedDepth).toBeLessThan(5);
    // Given more positions, the same search goes deeper: the budget, not the position, stopped it.
    const more = botSearch(wide, { maxDepth: 5, budget: 4 * DEFAULT_BUDGET }).stats;
    expect(more.completedDepth).toBeGreaterThan(deep.completedDepth);
  });

  // PRD B4 is bounded by the position budget, a count: a search applies at most DEFAULT_BUDGET
  // actions whatever the depth, and spending all of them was measured at about half a second
  // (DEFAULT_BUDGET in packages/bot/src/search.ts). So the proof is that every search stops within
  // the budget; the clock only catches a per-position slowdown of twenty times or more, a margin
  // enough that parallel test workers on a loaded machine cannot fail it.
  it('stops every search within the position budget at the defaults and at depth 5, on midgames and through a whole match (PRD B4)', { timeout: 120_000 }, () => {
    const midgame = play(MIDGAME_SCENARIO, MIDGAME_STEPS);
    const wide = play(MIDGAME_SCENARIO, BUDGET_STEPS);
    for (const state of [midgame, wide]) {
      expect(state.result).toBeNull();
      expect(state.fighters.every((fighter) => fighter.cell !== null && fighter.charge === 1)).toBe(true);
    }
    const deploying = play(MIDGAME_SCENARIO, MIDGAME_STEPS.slice(0, 1));
    // Every fifth position of a seeded bot-against-bot match, from the opening to its end.
    const match: MatchState[] = [];
    let state = botMatch(3);
    for (let turn = 0; turn < 60 && !state.result; turn += 1) {
      if (turn % 5 === 0) match.push(state);
      state = botChoice(state).next;
    }
    expect(match.length).toBeGreaterThan(3);

    let exhausted = 0;
    for (const position of [midgame, wide, deploying, ...match]) {
      for (const options of [{}, { maxDepth: 5 }, { maxDepth: 5, budget: 200 }]) {
        const budget = options.budget ?? DEFAULT_BUDGET;
        const started = performance.now();
        const { stats } = botSearch(position, options);
        const elapsed = performance.now() - started;
        expect(stats.positions).toBeLessThanOrEqual(budget);
        // A search that stops early for the budget has spent all of it, and only then.
        expect(stats.budgetExhausted).toBe(stats.positions === budget && stats.completedDepth < (options.maxDepth ?? DEFAULT_MAX_DEPTH));
        if (stats.budgetExhausted) exhausted += 1;
        expect(elapsed).toBeLessThan(10_000);
      }
    }
    // The bound is exercised: the wide midgame and others run the full budget out at depth 5.
    expect(botSearch(wide, { maxDepth: 5 }).stats.budgetExhausted).toBe(true);
    expect(exhausted).toBeGreaterThan(3);
  });
});

describe('bot match log (PRD L1, B3)', () => {
  it('replays a seeded bot-against-bot match with abilities and trap triggers exactly, after a JSON round trip', { timeout: 60_000 }, () => {
    let state = botMatch(1);
    const states = [state];
    for (let turn = 0; turn < 80 && !state.result; turn += 1) {
      state = botChoice(state).next;
      states.push(state);
    }
    const events = state.history.flatMap((entry) => entry.events);
    expect(state.history.some((entry) => entry.action.kind === 'ability')).toBe(true);
    expect(events.some((event) => event.kind === 'trap-triggered')).toBe(true);

    const parsed = parseMatchLog(JSON.parse(JSON.stringify(matchLogOf(state))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const replayed = replayMatchSteps(parsed.log, TILES);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.states).toHaveLength(states.length);
    expect(replayed.states.at(-1)).toEqual(state);
    expect(canonicalSignature(replayed.states.at(-1)!)).toBe(canonicalSignature(state));
    // The bot makes the same choice on every replayed state (PRD B3).
    for (const [index, action] of parsed.log.actions.entries()) {
      expect(replayed.states[index]).toEqual(states[index]);
      expect(botChoice(replayed.states[index]!).action).toEqual(action);
    }
  });
});
