# Task: web

## Goal

Turn `apps/web` into the published game **Constraint**: a title screen, a polished How to Play dialog, settings for move highlights and sound, synthesized sound effects, an unfinished match that survives a reload, local results per difficulty, and a static build that runs from any web host. Remove the playtest helpers, and fix the open review findings of playtest-ready.

## Context

- Read `docs/prd.md` (especially §5 and the release-polish changes in §5.8), `docs/architecture.md`, `features/release-polish/decisions.md`, and the current client in `apps/web/src` with its browser tests in `tests/e2e/`.
- Playtest helpers to remove from the interface: the seed field and seed display, the `?seed=`, `?preset=`, `?scenario=` and `?depth=` URL parameters, preset choice, scenario choice, `PresetBadge`, and the rules panel listing preset values. The game always plays `SPEC_V0_2`. The presets and scenarios stay in `@okiya/content` for the engine's tests.
- Open review findings to fix:
  - `turnState` in `apps/web/src/turn.ts` tells the player to choose "a highlighted cell matching" the constraint for every selected fighter, but for an ability it is the acting fighter's own tile that must match, not the target's;
  - `MatchScreen` auto-selects the first reserve fighter, so the total number of available actions never shows while the reserve is not empty;
  - the `action-feedback` browser test depends on the bot's random private seed, so it can fail at random.
- The `engine` lane runs in parallel and is verified without your changes. It hardens `parseMatchLog` so a malformed log is refused instead of throwing, and keeps every export and the bot's choices unchanged.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html`, `apps/web/vite.config.ts`, `tests/e2e` and the new `docs/publishing.md`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, other `docs/` files or `features/`. Add no dependencies, and no image, font or audio files: visuals stay inline SVG or CSS, and sound is synthesized with the Web Audio API.
- The title lives in one constant, `Constraint`, used by the page title, the title screen and all copy. Internal package names stay `@okiya/*`.
- Settings (highlights, sound), the saved match and the results live in `localStorage`, each read and written inside `try`/`catch`; a missing, corrupt or old saved match is discarded without crashing, and the game works when storage is unavailable.
- The saved match is the match log from `matchLogOf`, restored with `parseMatchLog` and `replayMatchSteps`; wrap the restore in `try`/`catch` as well, because your worktree has the unhardened `parseMatchLog`.
- Sound starts only after a user gesture, is short and quiet, and is never the only signal of an event.
- Match seeds and the bot's private seed come from `crypto.getRandomValues` and are never shown. Browser tests make them deterministic by replacing the page's randomness with a seeded one through Playwright's `addInitScript`, never through an app parameter.
- During play, render only the human's player view (PRD I4). Keep the StrictMode-safe bot scheduling, port 5493, reduced-motion handling and the light and dark themes.
- The production build uses relative asset paths (Vite `base: './'`), so it runs from a subfolder, a file host or an itch.io HTML5 upload.

## Acceptance

- Unit (`npm run test:unit`):
  - no screen renders a seed, preset choice, scenario choice or preset-values panel, and the app reads no URL parameters;
  - the How to Play content covers matching, every fighter from `FIGHTERS` and the objective from `OBJECTIVES`, and the dialog traps focus while open and restores it on close;
  - with highlights off, no cell carries the playable marker, and the legal-action list and refusal reasons are unchanged;
  - the turn text names the acting fighter's tile as the one that must match when an ability is selected, and shows the total available actions when nothing is selected, with no reserve fighter auto-selected;
  - a saved match round-trips through storage to the same state; a corrupt, truncated or unknown-version saved match is discarded; storage that throws leaves the game playable;
  - results count wins, losses and draws per difficulty and reset to zero;
  - the sound module stays silent while muted and before any user gesture.
- Build (`npm run build`) passes, and the built `index.html` references its assets by relative paths.
- `docs/publishing.md` explains, in a page at most, how to build the static bundle and publish it on itch.io (HTML5 zip), GitHub Pages and a generic static host.
- Browser, with scenario ids exactly as `policy.json` spells them: `title-screen`, `setup-flow`, `legal-turn`, `highlight-toggle`, `how-to-play`, `turn-feedback`, `action-feedback`, `resume-match`, `full-match`, `sound-toggle`, `dark-theme`, `phone-layout` and `keyboard-play`. `phone-layout` runs at a 390 px viewport, `dark-theme` emulates the dark colour scheme, and `full-match` fails after 200 actions.

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
