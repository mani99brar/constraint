# Task: ux

## Goal

Make `apps/web` pleasant and clear to play, per `docs/prd.md` §5.1, §5.4, §5.5 and §5.7. That means a proper visual design, turns whose state and options are obvious at a glance, visible feedback for every action, and a short guide for a first match. The player also chooses the preset, seed, scenario and bot depth at match start, the game works at phone width and by keyboard, and a browser test plays a match to its end screen.

## Context

- Read `docs/prd.md` §5 (especially §5.7, U1–U7) and §8, `docs/architecture.md`, and the current client in `apps/web/src` with its browser tests in `tests/e2e/`. Logic lives in plain `.ts` modules (`match`, `setup`, `selection`, `events`, `text`), and presentation in the `.tsx` components and `styles.css`.
- Already on `main`: `PRESETS` in `@okiya/content` (including `spec-v0.2-two-displacers`; the `engine` lane adds `spec-v0.2-locked-dont-count` and `spec-v0.2-repetition-2`), `SCENARIOS` (the paper test 01 fixture and its swapped-roster variant), `OBJECTIVES` and `FIGHTERS` with their summaries, and the optional third argument of `chooseAction` (`SearchOptions`, with a maximum depth) in `@okiya/bot`.
- The `engine` lane runs in parallel and is verified without your changes. It keeps every export and signature you use.
- The full-rules review left one finding here: `orderEvents` in `apps/web/src/events.ts` sorts every trap trigger before every charge loss or lock, so with two trap entries in one swap (spec §8.3), the feedback no longer pairs each trap with its effect.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies, and no image, font or audio files: draw terrain, symbols and tokens as inline SVG or CSS.
- During play, render only the human's player view (PRD I4). Never show the bot's reserve, traps, objective or inspection results before the end screen.
- Colour is never the only signal (PRD U1): every terrain, symbol and fighter also has a shape or text label. Define colours as theme tokens with a light and a dark set that follows the system colour scheme.
- Animations are short (under 400 ms), never block input, and are switched off under `prefers-reduced-motion`. Browser tests run with reduced motion and never wait on an animation.
- The onboarding guide's dismissed state lives in `localStorage`, read and written inside `try`/`catch`, so the game works when storage is unavailable.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin: match-start options, the bot depth choice, turn-state text, event pairing and highlights, keyboard focus movement and the guide's state.
- Keep the bot's setup on its private seed, the StrictMode-safe bot scheduling and port 5493. Browser tests read cells and the constraint from the page and hardcode only seeds.

## Acceptance

- Unit (`npm run test:unit`):
  - the match-start screen lists every preset in `PRESETS` and shows how the chosen one differs from `spec-v0.2` (PRD P2), lists every scenario in `SCENARIOS`, takes an optional seed, and maps the bot depth choice (Easy 1, Normal 2, Hard 3) to `SearchOptions`;
  - the turn-state text names whose turn it is, the constraint in words ("Forest or Moon") and the number of available actions, and says the bot is thinking during its turn;
  - with two trap entries in one action, each trap trigger is followed by its own charge loss or lock, and the cells to highlight after an action are exactly those its events involved;
  - the setup and match screens explain the player's objective in words from its `summary` in `@okiya/content`, and every fighter's help text comes from `FIGHTERS`;
  - the guide's state starts open on a first visit, stays dismissed once dismissed, and survives a storage that throws;
  - every theme colour pair used for text meets a 4.5:1 contrast ratio in both the light and the dark set;
  - arrow keys move focus across the 4×4 board without leaving it, and Enter or Space selects the focused cell or fighter.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them: `start-match`, `legal-turn`, `setup-flow`, `turn-feedback`, `preset-and-scenario`, `full-match`, `turn-clarity`, `action-feedback`, `onboarding-guide`, `dark-theme`, `phone-layout` and `keyboard-play`. `phone-layout` runs at a 390 px wide viewport, and `dark-theme` emulates the dark colour scheme. `full-match` may take any result (win, loss or draw) and stops with a failure after 200 actions.

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
