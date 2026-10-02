# Task: main

## Goal

Turn the repository into the walking skeleton of the game in `docs/prd.md`: a TypeScript monorepo with a working toolchain, a pure rules-engine package whose public API later features build on in parallel lanes, and one thin playable path where a browser player starts a match against a random-legal bot and takes legal turns on the 4×4 board.

## Context

- Read `docs/prd.md` first (§7 and §9 define this feature), then `docs/game-spec.md` §2–§4 (confirmed rules, components and coordinates, information model). `docs/paper-test-01.md` records the first paper playtest: its match ledger and its walkthroughs of the 45 edge cases in `docs/paper-simulation.md` §8. Later rules features turn those into tests; this one only needs the scenario type able to describe that fixture (board, rosters, traps, starter).
- The repository has only `docs/`, `CLAUDE.md` and `features/`. Node 24 and npm 11 are installed. Playwright's Chromium for `@playwright/test` 1.63.0 is already installed on this machine (the verifier shares `~/.cache/ms-playwright` read-only), so pin `@playwright/test` to exactly `1.63.0` and never run `playwright install`.
- The verifier runs `npm ci` in a clean worktree with an empty npm cache, then the policy's checks: `npm run typecheck`, `npm run test:unit`, `npm run build` and `npx --no-install playwright test --config=tests/e2e/playwright.config.ts`. Each must exist and pass from a clean checkout. Commit `package-lock.json`.
- The point of this feature is the seams. A later lane is verified alone and cannot compile against another lane's new types, so every API the parallel lanes will share must exist on `main` after this feature, even where its implementation is thin.

## Constraints

- npm workspaces, each with `src/`, its own `package.json` and a `tsconfig.json` extending `tsconfig.base.json`:
  - `packages/rules`: the pure rules engine. Plain serializable state, a function listing the legal actions for the active player, a function applying one action and returning the next state, and a per-player view that hides what §4 of the spec keeps private (objectives, reserve identities, live trap locations).
  - `packages/content`: the 16 terrain/symbol tiles, fighter definitions, objectives, the preset and the paper test 01 scenario as typed data with a validator. It depends on `packages/rules`, which defines the types (terrain, symbol, tile, fighter, preset, scenario); `packages/rules` never imports `packages/content`, and the engine receives tiles and the preset as arguments.
  - `packages/bot`: chooses an action from a player view and the legal-action list. In this feature it picks a random legal action with the seeded generator.
  - `apps/web`: the React client, rendering only the human's player view.
- Matches are one human against the bot, entirely in the browser. There is no server.
- The shared APIs in `packages/rules/src/api/` are complete even where behaviour is not, so the later `rules`, `bot` and `web` lanes never need a new export or field:
  - state: charges, traps, locks, protection and repetition history, plus a trap history recording every trap placed at setup or by the Trapper with its fate (live, triggered, removed by the Trap Checker); the action type covers deploy, move, recharge and ability activation;
  - the ability contract: each fighter module provides `targets` (its legal targets from the state, the actor and the preset) and `resolve` (a list of effects), and `src/core/` applies the effects and resolves traps, locks and the win check. Effect kinds cover relocating a fighter with how it entered, exchanging terrain, placing a trap, removing enemy traps with a private inspection result, protecting, restoring a charge, and the constraint rule. The context passed to modules includes the preset with its variant switches;
  - setup in two phases, as spec §5 and PRD S2 order it: one call prepares the match from the preset and seed and reveals the board; a second starts it from both sides' setups (roster and traps). Both calls take an optional scenario that overrides the board, the rosters, the traps or the starting player (PRD S4); a setup validator returns structured refusals (fighters not distinct, trap cells not distinct, the displacer limit);
  - applying an action returns the next state and the ordered resolution events (trap triggered, charge lost, lock applied, constraint set, match ended), which PRD R5 and I2 show;
  - the player view includes a public log of entries, with a Trapper placement's cell redacted, plus the viewer's own private inspection results, and an optional `reveal` (both objectives, both rosters and the full trap history) that is present only once the match has ended (PRD R6);
  - resolution events reach the client only through a per-player projection that redacts the other side's trap cells and inspection results, so `apps/web` never sees raw referee events;
  - a function that builds a hypothetical full state from a player view, filling hidden data with placeholders, which the legal-action listing and action application accept, so the bot can look ahead without reading the real state;
  - `packages/bot` exports both a setup choice (board, preset and seed to a setup) and an action choice (player view and legal-action list to an action);
  - the preset, scenario and match-log types.
  Implementations stay thin: fixed default rosters, traps stored but never triggered, ability modules that offer no targets, and only the events deploy and move produce.
- `packages/rules` and `packages/content` are pure: no DOM, rendering or network libraries, no timers, no wall-clock time and no `Math.random`. Shuffling and any other randomness come from a maintained PRNG library whose state serializes as plain data (for example pure-rand), pinned exactly and kept in the state. The bot draws from a generator seeded by the match seed and the turn number, both exposed in the player view, so its choices replay exactly without touching the match state. A unit test fails if their source imports one of these.
- Root files only at the paths the policy owns. Never change anything under `docs/` except creating `docs/architecture.md`, and never change `features/`. In `CLAUDE.md`, change only the commands line and keep the "Workflow (operator notes)" section as it is.
- Pin exact dependency versions. Use maintained libraries and framework features instead of hand-rolled replacements.
- Fixed local port for the web client: 5493, with Vite's `strictPort` on. The Playwright config starts it with `reuseExistingServer: false`.
- No per-package builds: every workspace's `exports` and `types` point at `src/`, `npm run typecheck` runs `tsc --noEmit` on each workspace, and `npm run build` type-checks the packages and runs `vite build` for `apps/web`, which bundles the packages from source. Nothing reads a package `dist/`. Before completing, run all four checks once after `git clean -xfd && npm ci`.
- The root `vitest.config.ts` never collects `tests/e2e/`.
- The bot's move in `apps/web` is scheduled from an effect whose cleanup clears its timer, and it applies only if the view's turn number still equals the one it was scheduled for, so React StrictMode's double mount never plays two bot moves.
- Browser tests read the constraint and the cells from the page: they pick a highlighted edge cell, and for the refusal an empty cell matching neither attribute. They hardcode only the seed, and only to fix who starts, so later rules and bot changes do not break them.
- Placeholder art only: shapes and text. Do not add image or audio files.
- Out of scope, as behaviour: recharge, abilities, traps, locks, protection, repetition draws, roster selection and trap placement screens, the heuristic bot, log export and replay. Use a fixed default roster for both sides.

## Acceptance

- `npm ci` then each of the four policy checks passes from a clean checkout.
- Unit (`npm run test:unit`, Vitest):
  - determinism: the same seed and action log give the same final state;
  - the board is a 4×4 grid of all 16 terrain/symbol pairs exactly once, shuffled by the seed;
  - legality: an action matching the current constraint by terrain only, or by symbol only, is legal; one matching neither is refused without changing the state;
  - normal movement is orthogonal and one square; a diagonal move is refused;
  - a player with no legal action loses;
  - the per-player view never contains the opponent's objective, reserve identities or live trap locations;
  - the purity rule holds for `packages/rules` and `packages/content`;
  - `packages/content` validates its tiles and fighters and rejects a duplicate tile.
  - the opening deployment must be on an outside-edge cell and sets the first constraint;
  - a match ends with a win when one side's four fighters fill a 2×2 square, and a draw when both do after one action;
  - the bot only ever returns an action from the legal-action list;
  - the setup validator refuses two identical fighters in a roster and two traps on one cell, with structured reasons, and accepts the default setups;
  - the bot's setup choice returns a setup the validator accepts, and the same view and seed give the same bot action;
  - applying a deploy returns a constraint-set event, and a player view's log redacts the cell of a Trapper placement entry (built by hand for the test);
  - the view's `reveal` is absent during play and holds both objectives, both rosters and the trap history once the match has ended;
  - the per-player event projection hides the other side's trap cell and inspection result in hand-built events;
  - a hypothetical state built from a player view is accepted by the legal-action listing and by action application;
  - starting a match with the paper test 01 scenario gives the fixture board and A as the starting player;
  - `packages/content` validates the paper test 01 fixture as a scenario: 16 distinct tiles, two distinct four-fighter rosters, two traps per side on distinct cells;
  - `packages/content` exports the preset `spec-v0.2` with `docs/prd.md` §6's values and variant switches at their defaults, and its validator rejects an impossible preset (for example a negative recharge budget).
- Build (`npm run build`): type-checks the packages and builds the web client with Vite.
- Browser, under `tests/e2e/` with `tests/e2e/playwright.config.ts`. Scenarios, with ids exactly as the policy spells them:
  - `start-match`: the landing page starts a match against the bot; the page shows 16 cells with their terrain and symbol, the opening rule in place of a constraint, and whose turn it is.
  - `legal-turn`: the player deploys onto a highlighted edge cell; the constraint shows that tile's pair; the bot replies with a legal action and the turn returns to the player. Clicking a non-matching cell shows the refusal reason and leaves the turn unchanged.

- `README.md` and the commands line of `CLAUDE.md` list the install, dev, test and build commands. `docs/architecture.md` maps each workspace to its responsibility and names the public API of `packages/rules`, in a page at most.

Browser checks: each scenario id appears in exactly one test title as `[scenario:<id>]`, and that test, when it passes, attaches exactly one image/png named `screenshot:<id>` (other attachments are fine). The verifier refuses anything else. Before completing, run the spec files you changed with a JSON report:

```bash
WORKFLOW_VERIFICATION_PHASE=worker PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/report.json \
  npx --no-install playwright test --config=tests/e2e/playwright.config.ts --reporter=json <spec files>
```

Then check the report with the verifier's own rules: run the exact `check-report` command the controller appends to this task when it pins it.

## Stop

Report `blocked` instead of continuing when any of these happens:

- `npm ci` or an install fails twice for reasons outside the repository (registry, network).
- A check can pass only by changing a path outside the owned paths.
- The PRD and `docs/game-spec.md` contradict each other on a rule this task asks you to enforce.
- After two hours of work, any required check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
