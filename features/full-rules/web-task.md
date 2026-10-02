# Task: web

## Goal

Turn `apps/web` into the full single-player interface of `docs/prd.md` §5.1–§5.3 and §5.7: roster selection and trap placement, every action kind offered from the legal-action list, ordered resolution feedback, the public log, the status and rules panels, and the end screen that reveals both sides.

## Context

- Read `docs/prd.md` §5.1–§5.3 and §5.7, `docs/game-spec.md` §4 (what is public), and `docs/architecture.md`. The current client is in `apps/web/src`, with browser tests in `tests/e2e/`.
- The client renders only `playerView(state, HUMAN)`; events reach it only through `projectEvents`, and the end screen reads `view.reveal`.
- The `rules` and `bot` lanes run in parallel, and you are verified without their changes: in your worktree abilities offer no targets, traps never trigger and the bot moves at random. Drive the interface generically from the legal-action list and the projected events, so new abilities and event kinds appear without interface changes.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Selection, highlighting, refusal text, event sequencing and log formatting live in plain TypeScript modules with unit tests. React components stay thin. Render-level checks may use `react-dom/server`, which is already installed.
- Ability actions, trap events and the end screen are tested at unit level with hand-built legal-action lists, events and views, because your worktree cannot produce them.
- Every match starts on the setup screen; nothing skips it. The screen also offers a "Use default setup" button that fills in the paper test 01 roster of side A (`defaultSetup`) and the setup traps on distinct cells chosen from the match seed, then starts the match. `start-match` and `legal-turn` start through that button; only `setup-flow` picks fighters and places traps by hand.
- Keep the bot's setup on its private seed, never shown. Keep the skeleton's StrictMode-safe bot scheduling and port 5493.
- Browser tests read cells and the constraint from the page and hardcode only the seed, and only to fix who starts.

## Acceptance

- Unit (`npm run test:unit`):
  - selecting a deployed fighter yields its legal move destinations and ability targets from a hand-built legal-action list, with one entry per action; selecting a reserve fighter yields its legal deployment cells;
  - every `ActionRefusal` and `SetupRefusal` code has readable text (PRD R4);
  - roster selection under a hand-built preset with a displacer limit of 1 shows the `displacer-limit` refusal from `validateSetup` when a second displacer is picked;
  - "Use default setup" produces a setup `validateSetup` accepts, with traps on distinct cells, and the same match seed gives the same traps;
  - projected events are shown in spec §11 order (positions, trap triggers, charge loss or lock, constraint, then the outcome), and a Trapper placement by the bot shows no cell (PRD R5, I2);
  - the end screen, rendered from a hand-built finished view, shows the result, both objectives, both rosters and every trap with its cell and fate (PRD R6);
  - every cell and fighter has an accessible name such as "B3, Water–Moon, your Pusher, charged" (PRD U3; keyboard navigation is deferred);
  - a match started without a seed generates one and shows it, and a seed typed in the field gives the same board as the same seed in `?seed=`;
  - when the bot starts, it makes the opening deployment before the player's first turn.
- Build (`npm run build`) passes.
- Browser, scenarios with ids exactly as `policy.json` spells them: `start-match`, `legal-turn`, `setup-flow` and `turn-feedback`.

Browser checks: each scenario id appears in exactly one test title as `[scenario:<id>]`, and that test, when it passes, attaches exactly one image/png named `screenshot:<id>` (other attachments are fine). The verifier refuses anything else. Before completing, run the spec files you changed with a JSON report:

```bash
WORKFLOW_VERIFICATION_PHASE=worker PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/report.json \
  npx --no-install playwright test --config=tests/e2e/playwright.config.ts --reporter=json <spec files>
```

Then check the report with the verifier's own rules: run the exact `check-report` command the controller appends to this task when it pins it.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A required screen needs a field or export that `@okiya/rules` does not offer.
- A check can pass only by changing a path outside the owned paths.
- After three hours of work, any required check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
