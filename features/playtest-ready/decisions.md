# Decisions: playtest-ready

From the grill session of 2026-10-02 with the operator.

## Decisions

- The objective is explained in words only, with no progress highlight: the setup and match screens show the objective's `summary` from `@okiya/content` (any one 2×2 block of the nine counts), and nothing marks a best block or counts the player's progress. Consequence: `web` adds no progress function; finding a square stays the player's job, as in the paper tests.
- `engine` adds two playtest presets to `PRESETS` in `packages/content/src`: `spec-v0.2-locked-dont-count` (the variant `lockedFightersCountTowardObjective` false) and `spec-v0.2-repetition-2` (`repetitionThreshold` 2). Consequence: both are validated and tested, and `web` lists them without change because it reads `PRESETS`; its `preset-and-scenario` browser test still uses only `spec-v0.2-two-displacers`.
- Under `spec-v0.2-locked-dont-count`, a lock expiring never wins on its own: objectives are checked only after a fully resolved action (spec §10, §11 step 7), so a square whose last member's lock expires counts at the next check after any player's action. Consequence: `engine` proves this timing with a unit test, and the owner can win after the opponent's next action if the opponent does not break the square.
- Showing the bot's publicly knowable options (paper test 04, `~/dev/okiya-playtests`) is deferred: it needs a new function in `packages/rules/src/api`, which no lane of this run owns. Consequence: this run keeps its scope and two-lane split.

## Assumptions

- The bot depth choice offers Easy (depth 1), Normal (depth 2, the default) and Hard (depth 3), passed to `chooseAction` through `SearchOptions`.
- An own trap on a cell the bot's Trap Checker inspected stays shown, marked "inspected by the bot, may have been removed": the inspected cell is public in the projected event, and spec §9 keeps the result private to the inspector.
- The full referee view, including the bot's roster, traps and objective, appears only in replay mode for an exported or loaded log; the export warns that the file reveals them.
- The `full-match` fixture log is built with the public API of `@okiya/rules` and stored under `tests/e2e`; how it is generated is the `web` lane's choice.
- Keyboard play is required on desktop; the 390 px phone layout is portrait and touch-first.
- No lane adds dependencies or changes any `package.json`, `package-lock.json`, root config or `packages/rules/src/api`.
- The workers run with a four-hour deadline (`--worker-timeout-seconds 14400`), so each lane's three-hour `## Stop` bound comes first.

## Deferred

- The bot's public options on the match screen: an API function on `main` first, then the display (paper test 04).
- A Line objective, which needs a new objective id in `packages/rules/src/api`.
- A draw after repeated single-option turns, and the support-fighter rebalances suggested in `~/dev/okiya-playtests/README.md`, which need spec revisions first.
- A progress highlight for the player's own Square, declined by the operator.
