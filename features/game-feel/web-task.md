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

  The light and dark themes each have their own material tones.
  - **CSS only:** draw every material in CSS (gradients and box-shadows), with no SVG `<defs>`, patterns or `url(#…)` fills, so Firefox renders them and no screen has duplicate `id` attributes. The felt is radial gradients with a fine repeating gradient on the table, the wood grain is a repeating gradient on `.board-frame`, and tile edges and depth come from inset and outer box-shadows.
  - **Solid base colours:** a token keeps its solid `background-color` in its player's colour, with the bevel as a `background-image` and inset shadows on top. An avatar keeps its solid theme-token fills, with shading as extra paths at partial opacity. The existing checks that tell the players apart then stay meaningful.
  - **Fast on a phone:** static gradients and shadows only. Nothing anywhere uses `filter: blur(` or `backdrop-filter`, and no filter applies to board cells, so the existing `.cell:hover` brightness filter goes. Filters outside the board stay, such as How to Play's `.mini-cell.dead` grayscale and button hovers.
  - **Readable text:** text over a material meets 4.5:1 against the material's worst colour. Every gradient stop of a surface that carries text is a theme token, paired in `theme.ts`'s TEXT_PAIRS with each text colour drawn on it, the tray's A–D and 1–4 labels included.
- **Reactions** (PRD U9) come in two layers on each avatar, both pure functions of the state, the last event and the mode, never of the board position:
  - **A resting face, `data-expression`:**
    - the player to move shows `to-move` ("ready"), or `thinking` for the bot while it chooses;
    - the waiting player shows `idle`;
    - at the end, `won` and `lost`, or `idle` for both on a draw.
  - **A one-shot motion on top, `data-reaction`:**
    - a take by X with no result gives X `nod` and the other seat `glance`; the bot's seat stays on its `thinking` face while it glances;
    - a refused tap by X gives X `wince` and the other seat none;
    - a win gives the winner `bounce`;
    - otherwise there is none (`data-reaction` absent).
  - **Replays:** the start of a game and a game resumed with Continue count as no event. Each event bumps a counter, shown as `data-reaction-key` and used as the React `key` of the moving element, so a second wince in a row plays again.

  Each motion is a CSS keyframe or transition started by that key, a class or a `data-` attribute. Each stays under 400 ms, never loops, never blocks input, puts `pointer-events: none` on any overlay, and is off under reduced motion. In the policy's `avatar-reactions` wording, "ready", "thinking", "won" and "lost" are faces read from `data-expression`, and nod, glance, wince and the bounce are read from `data-reaction`.
- **Seats and toasts:** on a phone each seat is a compact nameplate at most 96 px tall at 390 × 844, with Player 2 above the board and Player 1 below. On wide screens Player 1 sits left and Player 2 right. Toasts are shown where they never cover a board cell, at every viewport, and keep their behaviour: refusals clear when the turn changes, the bot's take is toasted, and there is no take toast in two-player games and never an end toast.
  - **Reserved slot:** toasts get a fixed slot outside the board, sized for two toasts (a take and a refusal can show together), so the board never moves when a toast appears or leaves.
  - **Phone fit:** at 390 × 844 the game fits without vertical scrolling both mid-game and with the end card and a toast shown. The compact nameplates pay for the slot. If the end state cannot fit, report `question` before building the phone layout.
  - **Token drop:** the drop stays inside its own cell's box (clipped or translated within it) and the falling token takes no taps, so a tap on a neighbouring tile during the drop lands on that tile.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin. Keep the StrictMode-safe bot scheduling, port 5493 and every storage key.
- **Browser tests:**
  - they fix the page's randomness through `addInitScript` and read tiles, tokens, seats and reactions from the page;
  - they never wait on an animation, except in scenarios that turn motion on with `page.emulateMedia({ reducedMotion: 'no-preference' })`;
  - `avatar-reactions` records every change of `data-expression`, `data-reaction` and `data-reaction-key` with a MutationObserver installed before each action, so the bot's short `thinking` face cannot be missed under parallel load;
  - they never depend on which tile the bot takes, and bot games use Easy or Normal with up to 10 seconds for the bot's reply;
  - every layout rule is checked at the default wide viewport and at 390 × 844.

## Acceptance

- Unit (`npm run test:unit`):
  - the home model gives Continue only for a saved game, the switch's difficulty (Normal by default, the remembered one after a change, Normal for older settings), and the results strip for each difficulty; the settings round-trip with the difficulty, and every storage key stays as `persistence.test.ts` pins it;
  - the reaction model gives each seat's resting face and one-shot reaction for every event, per the table in Constraints:
    - the start and a resumed game;
    - a take with no result by each seat;
    - a refused tap by each seat;
    - the bot choosing;
    - a win by line, square and blockade for each seat, and the draw;
    - in both modes.

    Two hand-built states with different boards but the same last event give the same faces and reactions, and repeated events give increasing reaction keys;
  - rendering the home screen, a match and the end screen produces no duplicate `id` attributes, and both avatars render every reaction;
  - the stylesheet test (`motion.test.ts` or a new one):
    - every animation and transition stays under 400 ms with none looping, checked through the shorthands and the longhands (`animation-duration`, `animation-delay`, `animation-iteration-count`, `transition-duration`, `transition-delay`);
    - it names the token drop, the reactions, the tile flight, the seat change and the winning stroke;
    - it finds no `filter: blur(`, no `backdrop-filter`, no filter on any rule whose selector targets board cells (`.cell`), and no `url(#` fill;
  - the theme tests keep every text pair at 4.5:1 in both themes, every gradient stop of a text-bearing material included;
  - `lowContrastText` in `tests/e2e/helpers.ts` reads the colour stops of the nearest painted `background-image` (Chrome reports them as `rgb()`/`color()`) and checks text against the worst stop as well as the solid colour, so `dark-theme` and `light-theme` see the materials;
  - every existing unit test that still applies passes, updated where the screens changed.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them:
  - `home-screen`, `start-from-home`, `match-screen`, `seats-turn`, `opening-take`, `legal-turn`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `two-player-match`, `sitting-score`, `starter-alternates`, `sound-toggle`, `dark-theme`, `light-theme`, `phone-layout`, `keyboard-play`, `avatar-reactions`, `table-materials` and `toasts-clear-board`;
  - `phone-layout` runs at 390 × 844 and `dark-theme` emulates the dark colour scheme;
  - `full-match` and `two-player-match` fail after 20 takes;
  - `seats-turn` and `legal-turn` keep their motion-on checks: the flying Match tile never takes a tap;
  - `toasts-clear-board` also checks that the board frame's position does not change when a toast appears and leaves;
  - `phone-layout` also checks that the end state (end card shown, with a toast) fits at 390 × 844 without vertical scrolling;
  - the token drop is checked with motion on in `avatar-reactions` or `table-materials`: a tap on a neighbouring glowing tile during the drop takes that tile.

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
