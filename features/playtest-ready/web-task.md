# Task: web

## Goal

Make `apps/web` ready for playtesting, per `docs/prd.md` §5.1, §5.4, §5.5, §5.6 and §5.7. The player chooses the preset, seed, scenario and bot depth at match start. Matches can be exported, loaded, stepped through and continued. The game works at phone width and by keyboard, and a browser test plays a match to its end screen.

## Context

- Read `docs/prd.md` §5 and §8, `docs/architecture.md`, and the current client in `apps/web/src` with its browser tests in `tests/e2e/`.
- Already on `main`: `matchLogOf`, `parseMatchLog`, `replayMatchSteps` and the `MatchLogRefusal` codes in `@okiya/rules`; `PRESETS` (including `spec-v0.2-two-displacers`) and `SCENARIOS` (including the paper test 01 fixture and its swapped-roster variant) in `@okiya/content`; and the optional third argument of `chooseAction` (`SearchOptions`, with a maximum depth) in `@okiya/bot`.
- The `engine` lane runs in parallel and is verified without your changes. It hardens log loading and tunes the bot, but keeps every export and signature you use.
- The full-rules review left one finding here: `orderEvents` in `apps/web/src/events.ts` sorts every trap trigger before every charge loss or lock, so with two trap entries in one swap (spec §8.3), the feedback no longer pairs each trap with its effect.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies: export with a Blob download, load with a file input.
- During play, render only the human's player view (PRD I4). The full referee view appears only in replay mode, for a log the player exported or loaded (PRD L3), and exporting warns that the file reveals the bot's secrets (PRD L2).
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin: export and load, step-through, continuing, preset differences, the bot depth choice, event pairing and keyboard focus movement.
- Keep the bot's setup on its private seed, the StrictMode-safe bot scheduling and port 5493. Browser tests read cells and the constraint from the page and hardcode only seeds or fixture logs.

## Acceptance

- Unit (`npm run test:unit`):
  - an exported log loads back through `parseMatchLog` and steps through with `replayMatchSteps`; stepping back and forward shows the matching state, and continuing from step k plays on from exactly that state;
  - every `MatchLogRefusal` code has readable text, naming the field or the refused action number;
  - with two trap entries in one action, each trap trigger is followed by its own charge loss or lock;
  - the match-start screen lists every preset in `PRESETS` and shows how the chosen one differs from `spec-v0.2` (PRD P2), lists every scenario in `SCENARIOS`, and maps the bot depth choice (at least depths 1, 2 and 3) to `SearchOptions`;
  - arrow keys move focus across the 4×4 board without leaving it, and Enter or Space selects the focused cell or fighter.
  - the setup screen and the match screen explain the player's objective in words from the objective's `summary` in `@okiya/content` (for Square: all four of your fighters on the four cells of any one 2×2 block, nine possible), not only its name.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them: `start-match`, `legal-turn`, `setup-flow`, `turn-feedback`, `preset-and-scenario`, `log-export-replay`, `full-match`, `phone-layout` and `keyboard-play`. `phone-layout` runs at a 390 px wide viewport. `full-match` loads a fixture log stored under `tests/e2e`, built with the public API, that ends one action before the human's Square win.

Browser checks: each scenario id appears in exactly one test title as `[scenario:<id>]`, and that test, when it passes, attaches exactly one image/png named `screenshot:<id>` (other attachments are fine). The verifier refuses anything else. Before completing, run the spec files you changed with a JSON report:

```bash
WORKFLOW_VERIFICATION_PHASE=worker PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/report.json \
  npx --no-install playwright test --config=tests/e2e/playwright.config.ts --reporter=json <spec files>
```

Then check the report with the verifier's own rules: run the exact `check-report` command the controller appends to this task when it pins it.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A required screen needs a field or export that `@okiya/rules`, `@okiya/content` or `@okiya/bot` does not offer.
- A check can pass only by changing a path outside the owned paths.
- After three hours of work, any required check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
