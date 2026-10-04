# Task: web

## Goal

Make the deployed table calm and clear, as the operator asked after playing it:
- tiles get room between them, on a quiet paper or slate ground with no felt;
- legal tiles stand out by brightness, a slight lift and a light wash of the mover's colour, with no outlines;
- the tile flight into the Match card goes;
- the end of a game plays as a short sequence on the board (at most 700 ms) while the result card is ready at once;
- the home screen has one play panel instead of two Play cards;
- the game screen shows each piece of information once, with tile names on demand.

The rules, the engine and the bot do not change.

## Context

- Read `docs/prd.md` v1.3, especially S1, R2, I1, I2, U1, U2, U8, the new U10, E1, E3 and E5. Then read `features/calm-table/decisions.md` and `features/game-feel/decisions.md` (whatever calm-table does not change still holds). The rules are `docs/game-spec.md` v1.0.
- The current client in `apps/web/src` is the `game-feel` build:
  - `HomeScreen.tsx` with `home.ts`;
  - `MatchScreen.tsx`, `Board.tsx`, `Seat.tsx`, `Avatar.tsx` and `reactions.ts`, `MatchCard.tsx`, `EndScreen.tsx`, `Toasts.tsx` and `TopBar.tsx`;
  - `settings.ts`, `theme.ts`, `art.tsx` and `styles.css`, which holds the only reduced-motion switch.

  The browser tests are in `tests/e2e/` (`game.spec.ts`, `layout.spec.ts`, `feel.spec.ts`, `helpers.ts`).
- What the deployed build looks like (2026-10-04):
  - the board's gap is 6 px between 144 px tiles (5 px at 76 px on a phone), about 4% of a tile;
  - a green felt with diagonal hatching sits behind everything;
  - legal tiles are outlined in the mover's colour, so Player 2's red reads as "forbidden";
  - the last take is a purple dashed box with a corner tab;
  - every tile shows a scene, an emblem and a text name;
  - the seats are large cards, and the score of the sitting appears twice (a corner pill and "Wins N" on each seat);
  - the end is a stroke, faces and a static card below the board;
  - the home screen has two Play cards and a tagline box;
  - at 390 px the home scrolls and the wordmark breaks as "Constrai / nt".

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/`, `features/` or `CLAUDE.md`. Add no dependencies and no image, font or audio files. All art stays original CSS or inline SVG.
- **Board:**
  - the tiles are separate raised pieces with a gap of about 12% of a tile (10–14%) between them and the same padding inside the board frame, at every viewport;
  - every tile and button stays at least 44 px at 390 × 844;
  - the A–D and 1–4 labels are lighter and smaller, still readable at 4.5:1.
- **Legal tiles** (R2), with highlights on:
  - matching tiles keep full brightness, lift slightly and carry a wash of about 15% of the mover's colour (a pseudo-element or overlay layer, never an outline or border);
  - the other free tiles fade to about 55%, by fading or veiling the art layers, never with `opacity` on the cell element itself, so any text on it stays solid;
  - taken cells (tokens) do not fade;
  - with highlights off, nothing fades, lifts or carries a wash;
  - keep `data-glow="true"` on legal cells and add `data-faded="true"` on faded ones;
  - keyboard focus keeps its own visible ring.
- **Last take** (I2): one warm tint on its cell, replacing the purple dashed box and corner tab. Keep `data-last`.
- **No tile flight** (U8): remove the `tile-arrive` flight from the board into the Match card. The card's contents crossfade in place, under 200 ms.
- **Tile names** (I1, E3):
  - names are not drawn on the tiles by default;
  - a tile's name shows on hover, on keyboard focus and on a long press (a pointer held 450 ms or more, which shows the name and does not take the tile; a normal tap still takes it), as a caption on a solid plate that meets 4.5:1;
  - the cell's accessible name always includes it;
  - a Tile names setting (off by default, stored with the settings under `okiya.settings`) shows names on every tile, on solid plates;
  - How to Play keeps its names.
- **Nameplates and score** (U2):
  - each seat is a slim nameplate (avatar, name, token mark, tokens left out of 8) beside the board on wide screens and above or below it on a phone;
  - the score of the sitting is one line between the nameplates (for example "You 2 – 1 Bot · 1 draw"), replacing the corner pill and the per-seat "Wins";
  - the faces, reactions and the lit or dimmed state of the seats stay.
- **Ground** (U1):
  - warm paper or linen in the light theme and desaturated slate ink in the dark theme, on the home screen and the game;
  - one soft radial glow behind the board, a gentle vignette and static grain of 3% or less (CSS only, no image);
  - no felt and no repeating diagonal or directional pattern;
  - retune the accent colours (buttons, switches) to the ground;
  - text never sits directly on a gradient without a solid plate, and contrast is checked against the worst stop.
- **End sequence** (U10, the one exception to U8):
  - at most 700 ms in total, pure CSS keyframes, with `animation-delay` for the one-after-another lift, keyed so it plays once per finished game;
  - a line or square: the four winning tokens lift one after another, the stroke is drawn and the other cells dim;
  - a blockade: the Match card shows that no tile matches ("No tile matches Desert–Star") and the remaining free tiles grey out;
  - a draw: the board settles evenly;
  - the result card and its Play again and Home buttons appear at once, beside the board on wide screens and below it on a phone, never overlapping any cell, and take taps from the first frame;
  - Play again and Home keep the same positions in every ending;
  - any tap or key during the sequence skips it to its final frame;
  - under reduced motion the final frame shows at once;
  - the winner's avatar keeps its bounce.
- **Home** (S1, E1, E5):
  - Continue above the panel when a game is saved;
  - one play panel with an Opponent switch (Bot | Friend, a radio group reachable by keyboard), the Easy / Normal / Hard switch shown only while Bot is chosen (removed from the page, not disabled), and one Play button labelled with the choice ("Play · Normal bot", "Play · with a friend");
  - both choices remembered in the settings (Bot and Normal at first; older settings load as Bot, Normal and names off);
  - with a saved game, the panel says that Play replaces it;
  - the tagline box is removed;
  - the results become one quiet line of wins, losses and draws per difficulty, and Reset moves into the Settings dialog, disabled until a bot game was counted;
  - the wordmark never breaks inside the word (`white-space: nowrap` with a size that fits);
  - at 390 × 844 the home fits without scrolling;
  - How to Play and Settings stay.
- **Fixes from the `game-feel-001` review:** remove the dead `Logo` component and the unused `.felt` styles, close the empty band at the bottom of the phone game, and restore its check.
- **Naming:** `release.test.ts` bans words such as `tray`, `pip` and `charge` in `styles.css`, so name classes and tokens after `board-frame`, `wood`, `ground`, `glow` or `wash`. Change the pinned `h1` only on purpose.
- **Keep:** the avatar faces and reactions, CSS-only materials, solid base colours under shading, the reserved toast slot, the token drop inside its cell, the stylesheet tests (shorthands and longhands), the scoped filter ban, every storage key, the StrictMode-safe bot scheduling, port 5493 and both themes.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin.
- **Browser tests:**
  - they fix the page's randomness through `addInitScript`;
  - they never wait on an animation except in scenarios that turn motion on;
  - they never depend on which tile the bot takes, and bot games use Easy or Normal with up to 10 seconds for the bot's reply;
  - every layout rule is checked at the default wide viewport and at 390 × 844;
  - motion checks are deterministic: reach a known ending by seeding `okiya.saved-match` near the end and using Continue (no event), confirm a running animation with `getAnimations()`, and record attribute changes with a MutationObserver installed before the action.

## Acceptance

- Unit (`npm run test:unit`):
  - the board model marks legal cells (`glow`), faded cells (only free non-matching tiles, and none with highlights off or at the end), the wash colour (the mover's), and the last take, for hand-built states in both modes;
  - the settings round-trip with the opponent, the difficulty and the Tile names setting, older settings load as Bot, Normal and off, and every storage key stays as `persistence.test.ts` pins it;
  - the home model gives the Play label for each opponent and difficulty, Continue only for a saved game, and the one-line results;
  - the end model gives, for each ending (line, square and blockade for each seat, and the draw, in both modes), which cells lift and in what order, which dim or grey out, and the Match card's "no tile matches" text for a blockade;
  - the stylesheet test:
    - every animation and transition stays under 400 ms except the end-sequence rules, whose delay plus duration stays at or under 700 ms;
    - none loops, checked through shorthands and longhands;
    - `tile-arrive` is gone;
    - no felt or repeating diagonal background remains;
    - the scoped filter ban holds;
  - the theme tests keep every text pair at 4.5:1 in both themes, the new ground, plates and accents included;
  - existing unit tests that still apply pass, updated where screens changed.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them:
  - `home-screen`, `start-from-home`, `match-screen`, `seats-turn`, `opening-take`, `legal-turn`, `legal-tiles`, `tile-names`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `end-sequence`, `two-player-match`, `sitting-score`, `starter-alternates`, `sound-toggle`, `dark-theme`, `light-theme`, `phone-layout`, `keyboard-play`, `avatar-reactions`, `table-materials` and `toasts-clear-board`;
  - `phone-layout` runs at 390 × 844 and checks the home and the game, mid-game and at the end, without vertical scrolling and with no empty band at the bottom;
  - `dark-theme` emulates the dark colour scheme;
  - `full-match` and `two-player-match` fail after 20 takes;
  - `end-sequence` turns motion on and, for a line or square win and for a blockade, reached through a seeded save:
    - the lift order;
    - the dimmed or greyed cells;
    - the blockade text in the Match card;
    - that Play again takes a tap during the sequence;
    - that a tap skips to the final frame;
    - that the result card never overlaps a cell, at both viewports.

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
