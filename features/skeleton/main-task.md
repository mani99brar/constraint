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
  - `packages/content`: the 16 terrain/symbol tiles, fighter definitions and objectives as typed data with a validator.
  - `packages/bot`: chooses an action from a player view and the legal-action list. In this feature it picks a random legal action with the seeded generator.
  - `apps/web`: the React client, rendering only the human's player view.
- Matches are one human against the bot, entirely in the browser. There is no server.
- The shared APIs are complete even where behaviour is not: the state holds charges, traps, locks, protection and repetition history; the action type covers deploy, move, recharge and ability activation; one ability interface exists for the eight fighters; the preset, scenario and match-log types exist. Later lanes fill these in without changing their shape.
- `packages/rules` and `packages/content` are pure: no DOM, rendering or network libraries, no timers, no wall-clock time and no `Math.random`. Shuffling and any other randomness come from a seeded generator kept in the state. A unit test fails if their source imports one of these.
- Root files only at the paths the policy owns. Never change anything under `docs/` except creating `docs/architecture.md`, and never change `features/`. In `CLAUDE.md`, change only the commands line and keep the "Workflow (operator notes)" section as it is.
- Pin exact dependency versions. Use maintained libraries and framework features instead of hand-rolled replacements.
- Fixed local port for the web client: 5493. The Playwright config starts it.
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
  - `packages/content` exports the preset `spec-v0.2` with `docs/prd.md` §6's values and variant switches at their defaults, and its validator rejects an impossible preset (for example a negative recharge budget).
- Build (`npm run build`): builds every package and the web client with Vite.
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
