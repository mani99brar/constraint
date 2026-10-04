# Task: web

## Goal

Make Constraint feel like a finished physical game without changing its theme or rules.
- **Home screen:** one screen replaces the title, mode and difficulty screens. It has a hero, Continue, a Versus bot card with a remembered difficulty switch, a Two players card and a compact results strip, and one tap on Play starts a game.
- **Materials:** the art gets a tabletop-materials finish: one light, soft shadows, a wood-grain tray on felt, tiles with depth, bevelled tokens that drop and settle, and shaded avatars.
- **Reactions:** the two avatars react to what just happened.
- **Fixes:** toasts never cover a tile, and phone seats become compact nameplates.

Everything stays subtle: no callouts, badges or celebration text.

## Context

- Read `docs/prd.md` v1.2, especially S1, E1, U1–U3, U8 and the new U9, then `features/game-feel/decisions.md`. The rules are `docs/game-spec.md` v1.0, unchanged.
- The current client in `apps/web/src`:
  - `TitleScreen.tsx`, `ModeScreen.tsx` and `DifficultyScreen.tsx` with `App.tsx`'s screen flow;
  - `MatchScreen.tsx` with `Seat.tsx`, `Avatar.tsx` (four expressions), `MatchCard.tsx`, `Board.tsx`, `Token.tsx`, `Toasts.tsx` and `EndScreen.tsx`;
  - the art in `art.tsx`, the theme tokens in `theme.ts`, and `styles.css`, which holds the only reduced-motion switch;
  - the pure models `seats.ts`, `boardModel.ts`, `matchCard.ts`, `announce.ts`, `toasts.ts`, `score.ts`, `save.ts`, `settings.ts` and `results.ts`.

  The browser tests are in `tests/e2e/` (`game.spec.ts`, `layout.spec.ts`, `helpers.ts`). Keep every behaviour these changes do not replace: two-player play, the seats, the Match card, the score of a sitting, saves, results, How to Play, highlights, sound, both themes and keyboard play.
- What the build of 2026-10-04 looks like:
  - the title screen is three plain buttons over a table of zeros;
  - New game leads to two near-empty screens of left-aligned text cards;
  - the match table is a flat grey-green with white seat boxes;
  - the bot's take toast sits over row A of the board on desktop and phone, hiding tiles;
  - on a phone each seat is a tall box with empty space.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/`, `features/` or `CLAUDE.md`. Add no dependencies and no image, font or audio files.
- All art is original inline SVG or CSS that you draw. It keeps the theme: the four terrains, the four emblems, the wooden tray, the two avatars and the palette. It never imitates the published Okiya game's art or branding.
- **Home screen** (the title screen):
  - **Hero:** the "Constraint" wordmark drawn in the materials style, over a small board tray with tiles, flanked by both avatars.
  - **Continue:** shown when a game is saved, with its mode and number of takes.
  - **Versus bot card:** an Easy / Normal / Hard switch, a radio group reachable by keyboard, that remembers the last choice in the settings stored under `okiya.settings` (Normal at first; older settings without it load as Normal), and a Play button.
  - **Two players card:** a Play button.
  - **Results strip:** wins, losses and draws per difficulty, compact, with its reset (disabled until a bot game was counted).
  - **How to Play and Settings** as secondary buttons.

  When a game is saved, the play cards say that starting replaces it. Remove `ModeScreen.tsx` and `DifficultyScreen.tsx`, and give the cards the material finish.
- **Materials:**
  - one light source from the top left, soft shadows, a felt table surface and a wood-grain tray;
  - tiles with a slight edge and depth, keeping their scene, emblem and label readable;
  - bevelled tokens that keep their shape marks (ring and diamond) and drop and settle when placed;
  - shaded avatars, with seat nameplates, the Match card, the end card and the dialogs in the same materials.

  The light and dark themes each have their own material tones. Define shared patterns and gradients once per page (one hidden `<svg><defs>`, or CSS), so no screen renders duplicate `id` attributes. Keep it fast on a phone: static patterns, gradients and shadows only, with no `filter: blur()`, no `backdrop-filter` and no filter repeated on the 16 cells.
- **Reactions:** the avatars react only to what just happened (PRD U9):
  - `ready` for the player to move;
  - `thinking` for the bot while it chooses;
  - `nod` for a player who just took;
  - `wince` for a player whose tap was just refused;
  - `glance` for the waiting player when the other one takes;
  - `won`, with a small bounce, and `lost` at the end.

  The reaction is a pure function of the last event and the mode; it never reads the board position. Each reaction is a CSS keyframe or transition started by a class, a `data-` attribute or a React `key`. Each stays under 400 ms, never loops, never blocks input, uses `pointer-events: none` on any overlay, and is off under reduced motion. Expose it as `data-reaction` on the avatar.
- **Seats and toasts:** on a phone each seat is a compact nameplate at most 96 px tall at 390 × 844, with Player 2 above the board and Player 1 below. On wide screens Player 1 sits left and Player 2 right. Toasts are shown where they never cover a board cell, at every viewport, and keep their behaviour: refusals clear when the turn changes, the bot's take is toasted, and there is no take toast in two-player games and never an end toast.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin. Keep the StrictMode-safe bot scheduling, port 5493 and every storage key.
- **Browser tests:**
  - they fix the page's randomness through `addInitScript` and read tiles, tokens, seats and reactions from the page;
  - they never wait on an animation, except in scenarios that turn motion on with `page.emulateMedia({ reducedMotion: 'no-preference' })`;
  - they never depend on which tile the bot takes, and bot games use Easy or Normal with up to 10 seconds for the bot's reply;
  - every layout rule is checked at the default wide viewport and at 390 × 844.

## Acceptance

- Unit (`npm run test:unit`):
  - the home model gives Continue only for a saved game, the switch's difficulty (Normal by default, the remembered one after a change, Normal for older settings), and the results strip for each difficulty; the settings round-trip with the difficulty, and every storage key stays as `persistence.test.ts` pins it;
  - the reaction model gives each seat's reaction for every event (start, own take, other's take, refused tap, bot choosing, end by each kind, in both modes). Two hand-built states with different boards but the same last event give the same reactions;
  - rendering the home screen, a match and the end screen produces no duplicate `id` attributes, and both avatars render every reaction;
  - the stylesheet keeps every animation and transition under 400 ms with none looping, names the token drop, the reactions, the tile flight, the seat change and the winning stroke, and has no `filter: blur(`, no `backdrop-filter`, and no filter on the board cells (`motion.test.ts` or a new stylesheet test);
  - the theme tests keep every text pair at 4.5:1 in both themes, the new material tones included;
  - every existing unit test that still applies passes, updated where the screens changed.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them:
  - `home-screen`, `start-from-home`, `match-screen`, `seats-turn`, `opening-take`, `legal-turn`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `two-player-match`, `sitting-score`, `starter-alternates`, `sound-toggle`, `dark-theme`, `light-theme`, `phone-layout`, `keyboard-play`, `avatar-reactions`, `table-materials` and `toasts-clear-board`;
  - `phone-layout` runs at 390 × 844 and `dark-theme` emulates the dark colour scheme;
  - `full-match` and `two-player-match` fail after 20 takes;
  - `seats-turn` and `legal-turn` keep their motion-on checks: the flying Match tile never takes a tap.

Browser checks: each scenario id appears in exactly one test title as `[scenario:<id>]`, and that test, when it passes, attaches exactly one image/png named `screenshot:<id>` (other attachments are fine). The verifier refuses anything else. Before completing, run the spec files you changed with a JSON report:

```bash
WORKFLOW_VERIFICATION_PHASE=worker PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/report.json \
  npx --no-install playwright test --config=tests/e2e/playwright.config.ts --reporter=json <spec files>
```

Then check the report with the verifier's own rules: run the exact `check-report` command the controller appends to this task when it pins it.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A required screen needs a field or export that `@okiya/game` or `@okiya/bot` does not offer.
- A check can pass only by changing a path outside the owned paths.
- After three hours of work, any required check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
