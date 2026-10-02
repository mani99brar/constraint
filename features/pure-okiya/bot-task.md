# Task: bot

## Goal

Give Constraint v1.0 a real opponent. `chooseTake` in `packages/bot/src/take.ts` gets three strengths: Easy looks one take ahead, Normal three, and Hard plays perfectly, so it never misses a forced win or draw.

## Context

- Read `docs/game-spec.md` (rules v1.0), `docs/prd.md` (§5.4) and `features/pure-okiya/decisions.md`. The rules engine is `@okiya/game` (`packages/game/src`): `newGame`, `legalTakes`, `take`, `LINES`, `SQUARES`, `tilesMatch`, `cellIndex`. Every state is public, so the bot reads the real state, not a view.
- `packages/bot/src/take.ts` holds the thin first version: take a winning tile if one exists, otherwise the first legal tile. The `web` lane runs in parallel, is verified against that thin version, and calls only `chooseTake(state, { difficulty })`.
- A naive exhaustive solver (bitmasks for both players' tokens, a match mask per tile, a transposition table, and a cutoff on a found win) measured on this machine: one opening's subtree solves in about 0.1–0.3 s; all 12 openings take 1.4–3.5 s.

## Constraints

- Change only `packages/bot/src`. Never change `packages/game`, `packages/rules`, `packages/content`, any `package.json`, `package-lock.json`, root configs, `tests/`, `docs/` or `features/`. Add no dependencies.
- Keep the signature `chooseTake(state: GameState, options?: TakeOptions): CellId` and the exports `DIFFICULTIES`, `Difficulty` and `TakeOptions` from `packages/bot/src/index.ts`. Also keep every other existing export of that file (`chooseAction`, `chooseSetup` and the search exports for the old rules) and `tests/unit/bot.test.ts` passing: the old client still uses them on `main`, and they are removed after this feature merges.
- The bot is pure and deterministic (`tests/unit/purity.test.ts`): the same state and options always give the same take. Where several takes are equally good, break the tie with a value derived from `state.seed` and the number of takes, so games against the bot vary from seed to seed without randomness.
- Easy takes an immediate win when one exists and otherwise picks any legal take by the seeded tie-break; it does not look further. Normal searches three takes ahead. Hard at the opening (no last tile yet) plays Normal's three-take search. From the second take of the game on, Hard plays perfectly in two phases:
  - an exact win/draw/loss solve of every legal take, with a transposition table;
  - among the takes with the best value, it prefers an immediate win, and when losing, a take after which the opponent has no immediate win. Remaining ties go to the seeded tie-break.

  No search for the fastest win or longest loss beyond that is required.
- Size the exported position budget so a take fits about half a second on this machine, which leaves headroom for slower laptops and the browser's main thread (PRD B5).
- No wall-clock time anywhere under `packages/bot/src`, tests included: the purity test scans them (`Date.now`, `new Date`, `performance.now`, and no workaround such as `process.hrtime`).

## Acceptance

- Unit (`npm run test:unit`), in tests under `packages/bot/src`:
  - legality: over seeds 0–49, Easy against Normal and Normal against itself; and over seeds 0–9, Hard against Hard, Normal and Easy. `chooseTake` returns one of `legalTakes(state)` at every turn of these bot-against-bot games. Determinism: on 20 positions taken from them, a second call with the same state and options gives the same take;
  - every difficulty takes an immediate win when one exists (a line, a square or a blockade of the opponent);
  - Normal and Hard avoid a take that lets the opponent win at once whenever another take exists;
  - Hard is perfect: on positions from seeds 0–19, from the second take on, the exact win/draw/loss value of Hard's take equals the best value available. A reference solver in the test computes the values on bitmasks, independently of the bot's code, not on `take()` and `legalTakes()`. Among best-valued takes, Hard takes an immediate win when one exists;
  - both solvers agree with the engine: on at least 200 positions with 8 or fewer empty cells, Hard's solver and the reference solver each give the same value as a brute force built on `take()` and `legalTakes()`. The positions must include a full-board draw, a blockade, a shape completed at the same moment as a blockade, and an edge-only opening position;
  - strength over seeds 0–39 exactly, fixed before any game is played, with alternating starters, scoring a win 1, a draw ½ and a loss 0:
    - Hard never loses a game whose value at Hard's first take after the opening is a draw or a win for Hard, as the reference solver computes it;
    - Hard scores at least as much as Normal, and more than Easy;
    - Normal scores more than Easy;
  - speed is proven by counting positions, never by a clock: every take at every difficulty searches at most the exported position budget. After the opening, Hard completes its exact solve within that budget on every tested position. A comment records the measured positions per second behind the half-second sizing;
  - the bot's test files finish within 120 seconds in total on this machine; a test that needs more than Vitest's 5-second default sets its own timeout.
- `npm run typecheck` and `npm run build` pass.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A test can pass only by changing a path outside `packages/bot/src`.
- Hard cannot complete its exact win/draw/loss solve after the opening within a position budget that fits about half a second per take.
- After three hours of work, the `unit` check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
