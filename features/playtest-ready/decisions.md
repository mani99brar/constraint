# Decisions: playtest-ready

From the grill session of 2026-10-02 with the operator.

## Decisions

- Recording and replay are dropped from this feature: no export, loading, step-through or continuing a log in the interface (PRD L2 and L3 deferred beyond v1). The `web` lane became the `ux` lane, which owns all of `apps/web` and improves the UI and UX: visual design, turn clarity, action feedback and onboarding (PRD U4–U7), alongside the match-start choices, phone layout and keyboard play. Consequence: two lanes, `engine` and `ux`; a separate looks-only lane was rejected because two lanes cannot both own `apps/web`, and `parseMatchLog` hardening is deferred with the loading screen.
- The objective is explained in words only, with no progress highlight: the setup and match screens show the objective's `summary` from `@okiya/content` (any one 2×2 block of the nine counts), and nothing marks a best block or counts the player's progress. Consequence: `ux` adds no progress function; finding a square stays the player's job, as in the paper tests.
- `engine` adds two playtest presets to `PRESETS` in `packages/content/src`: `spec-v0.2-locked-dont-count` (the variant `lockedFightersCountTowardObjective` false) and `spec-v0.2-repetition-2` (`repetitionThreshold` 2). Consequence: both are validated and tested, and `ux` lists them without change because it reads `PRESETS`; its browser tests use only presets already on `main` (`spec-v0.2` for `full-match`, `spec-v0.2-two-displacers` for `preset-and-scenario`), because `ux` is verified without the `engine` lane's new presets.
- Under `spec-v0.2-locked-dont-count`, a lock expiring never wins on its own: objectives are checked only after a fully resolved action (spec §10, §11 step 7), so a square whose last member's lock expires counts at the next check after any player's action. Consequence: `engine` proves this timing with a unit test, and the owner can win after the opponent's next action if the opponent does not break the square.
- Showing the bot's publicly knowable options (paper test 04, `~/dev/okiya-playtests`) is deferred: it needs a new function in `packages/rules/src/api`, which no lane of this run owns. Consequence: this run keeps its scope and two-lane split.

## Assumptions

- The bot depth choice offers Easy (depth 1), Normal (depth 2, the default) and Hard (depth 3), passed to `chooseAction` through `SearchOptions`.
- An own trap on a cell the bot's Trap Checker inspected stays shown, marked "inspected by the bot, may have been removed": the inspected cell is public in the projected event, and spec §9 keeps the result private to the inspector.
- Visuals are drawn in code (inline SVG or CSS), with no image, font or audio files and no new dependencies; theme colours are tokens with a light and a dark set.
- The guide's dismissed state is stored in `localStorage` behind `try`/`catch`.
- Keyboard play is required on desktop; the 390 px phone layout is portrait and touch-first.
- No lane adds dependencies or changes any `package.json`, `package-lock.json`, root config or `packages/rules/src/api`.
- The workers run with a four-hour deadline (`--worker-timeout-seconds 14400`), so each lane's three-hour `## Stop` bound comes first.

## Deferred

- Log export, loading, step-through and continuing (PRD L2, L3), and hardening `parseMatchLog` against untrusted files.
- The bot's public options on the match screen: an API function on `main` first, then the display (paper test 04).
- A Line objective, which needs a new objective id in `packages/rules/src/api`.
- A draw after repeated single-option turns, and the support-fighter rebalances suggested in `~/dev/okiya-playtests/README.md`, which need spec revisions first.
- A progress highlight for the player's own Square, declined by the operator.
