# Task: web

## Goal

The final polish of Constraint, from the operator's feedback on the deployed build:
- **Move highlights:** the playable tiles pop up and glow in the mover's colour, unmistakably, in every theme.
- **Colours:** one coherent colour scheme, offered as three colour themes (Walnut and parchment by default, Sea glass and stone, Clear) with light and dark variants and a Theme switch in the menu.
- **Score:** a scoreboard row above the board puts the score beside the Match card.
- **Phone:** the game fits a phone without an empty band at the bottom.

The rules, the engine and the bot do not change.

## Context

- Read `docs/prd.md` v1.4, especially R2, I1, I2, U1, U2, U5, U8, E3 and P3. Then read `features/final-polish/decisions.md`, plus `features/calm-table/decisions.md` and `features/game-feel/decisions.md`: what this feature does not change still holds. The rules are `docs/game-spec.md` v1.0.
- The current client in `apps/web/src` is the calm-table build:
  - `MatchScreen.tsx`, `Board.tsx` and `boardModel.ts`, `Seat.tsx`, `MatchCard.tsx`, `TopBar.tsx`, `EndScreen.tsx`, `MenuDialog.tsx`, `HomeScreen.tsx`;
  - `settings.ts`;
  - `theme.ts` (the `LIGHT` and `DARK` tokens, `MATERIALS`, `TEXT_PAIRS` and `themeStyleSheet()`);
  - `styles.css`, which holds the only reduced-motion switch.

  The browser tests are in `tests/e2e/` (`game.spec.ts`, `layout.spec.ts`, `feel.spec.ts`, `calm.spec.ts`, `helpers.ts`).
- What the deployed build looks like (2026-10-04):
  - **Highlights:** playable tiles carry a ~15% wash that is barely distinguishable from the faded tiles, and nothing moves when a turn starts.
  - **Colours:** they come from unrelated families: teal buttons (`--primary` `#2c5a60`), a primary blue and a brick red for the players (`#2c5aa0`, `#a63b2b`), a mustard last-take square (`--legal` `#d97706`), and a navy-slate dark ground under brown wood.
  - **Score:** it floats as a pill above the board on desktop, while the Match card sits under Player 1's nameplate. On a phone the score floats between Player 2's nameplate and the board.
  - **Phone:** about 200 px is empty at the bottom.
  - **Nameplates:** "Player 2's move" wraps onto two lines inside the nameplate.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/`, `features/` or `CLAUDE.md`. Add no dependencies and no image, font or audio files. Name CSS classes and tokens so `release.test.ts`'s banned words (`tray`, `pip`, `charge` and others) never appear in `styles.css`.
- **Move highlights** (R2), with highlights on and a person to move:
  - **The pop:** when the turn starts, the legal tiles pop up one after another: CSS keyframes with `animation-delay` for the stagger, under 400 ms in all, played once per turn (keyed on the turn, never replayed by a re-render, never remounting the board).
    - **Restart every turn:** the pop must restart for every legal tile, including one that stays legal across a turn change in a two-player game. Alternate two identical keyframe names by the take count's parity, keyed on a `data-pop-turn` attribute, because changing `data-pop-order` alone does not restart a CSS animation.
    - **Static delays:** write the stagger as one static rule per `data-pop-order` value (up to 12 at the opening, so about 15–20 ms apart), never `calc(var(...) * N)`, so the stylesheet test can bound it.
    - **Cascade trap:** a parity rule such as `.board[data-pop-turn='odd'] .cell[data-glow='true'] { animation: pop-odd … }` resets `animation-delay` through the shorthand and outranks a plain `.cell[data-pop-order='3']` rule. Make the order rules at least as specific and put them later, or set only `animation-name` in the parity rules. A unit or browser check proves the delays differ by order.
  - **The resting look:** they stay raised with a soft halo (spread at most a third of the gap between tiles, so bare well stays visible), a 2–3 px ring in the mover's colour, a tint of about 30% of it (an overlay inside the tile art, below any name plate), and a corner badge with the mover's token mark (the existing ring or diamond shape).
  - **The faded tiles:** the other free tiles fade back by veiling the art, never by `opacity` on the cell.
  - **Bot's turn and highlights off:** on the bot's turn, and with highlights off, nothing pops, fades, glows or carries a tint or badge.
  - **Reduced motion:** under reduced motion the tiles show raised at once.
  - **Attributes:** keep `data-glow="true"` on legal cells and `data-faded="true"` on faded ones, and add `data-pop-order` for the stagger.
- **Last take** (I2): a soft ring in the last mover's colour on its cell, replacing the mustard tint. Keep `data-last`.
- **Colour themes** (U5, E3):
  - **The themes and their seed values** (the families and the default are fixed; adjust the hex values only to pass contrast):
    - **Walnut and parchment** (`walnut`, the default):
      - light: parchment ground `#F3EBDD`–`#E8DCC7`, walnut buttons `#6B4A30` with cream text, ink-brown text `#2B2118`;
      - dark: warm charcoal `#1E1A16` with cream text;
      - players: indigo `#34509A` (dark `#9DB2F0`) and terracotta `#B4533A` (dark `#F0A07F`).
    - **Sea glass and stone** (`seaglass`):
      - light: pale stone `#EEF0EC`, a driftwood frame, deep teal buttons `#1F5F5B`;
      - dark: teal-ink `#14201F`;
      - players: teal-navy `#2E4A8A` and amber `#C27A1A`.
    - **Clear** (`clear`): high contrast, a near-white or near-black ground, stronger rings and text.
  - **Variants:** each theme has a light and a dark variant following `prefers-color-scheme`.
  - **One family:** within a theme, the ground (the soft glow, vignette and grain stay), the wooden board frame, the tiles (re-tuned to the theme's saturation, keeping each terrain's identity), the nameplates, the buttons and switches, the Match card, the end card and both players come from one family. Remove the old teal `--primary`, brick-red Player 2 and mustard `--legal` from every theme.
  - **Pale inlay (light variants):** the board well (its own theme token, `--well`), meaning the `.board` inlay between and around the tiles (today `--frame-edge` dark wood), is a pale tone of the theme's ground (about `#E8DCC7` for Walnut, `#EEF0EC` for Sea glass, near-white for Clear). Wood stays on the outer board frame only. One colour per player then serves as the token fill, the score text (4.5:1 on its card) and the move ring (3:1 against the pale well). The dark variants keep a dark well, where the light player colours pass. Do not add pastel ring colours or a second ring colour.
  - **Whose-turn stripe:** it moves from the wooden board frame to the edge of the well on the mover's side (left or right on wide screens, bottom or top on a phone), where the player colour reaches 3:1. Update the `frameStripe` probe to read it there.
  - **Tokens:** `theme.ts` holds each theme's light and dark tokens. Its stylesheet maps them to `:root[data-palette="walnut|seaglass|clear"]`, with the dark variant under `prefers-color-scheme: dark`. Use the same selectors in the dark block as in the light one (for example `:root, :root[data-palette='walnut']` in both), or the light tokens win by specificity in dark mode.
  - **Choosing a theme:** a Theme choice (a radio group reachable by keyboard) in the menu dialog, also opened as Settings from the home screen, stored as a new field in the settings under `okiya.settings` (older settings load as `walnut`). There is no pop-up or first-run picker.
  - **No flash:** a small inline script in `apps/web/index.html` sets `data-palette` from the stored settings before the first paint, so the default theme never flashes first.
    - `release.test.ts` forbids `/okiya/i` in `index.html`. Allow exactly the storage-key literal `okiya.settings` there (a precise exception, not a looser rule), and never disguise the key.
    - Give `:root` without a `data-palette` attribute the walnut tokens, so an unknown or missing id still renders the default.
    - Unit-test the script by evaluating it against a fake storage holding each theme, a missing value and a malformed one, and check that the palette ids and the key match `settings.ts`.
- **Scoreboard row** (U2, I1, P3):
  - above the board: `[Player 1's score] [Match card] [Player 2's score]`, each score (that seat's wins in the sitting) on its player's side in its player's colour with its token mark, and the draws small under the Match card ("1 draw", hidden at zero);
  - on desktop the Match card is at the top centre, no longer under Player 1's nameplate. It is a compact horizontal strip at most 64 px tall, draws line included, and the layout's height budget accounts for it, so at 1280 × 720 the board frame stays at least 500 px tall without page scrolling;
  - on a phone the scoreboard row is the top row, with the menu button at its end;
  - remove the floating score line;
  - the scoreboard has an accessible name that reads the score ("You 2, Bot 1, 1 draw");
  - the nameplates keep avatar, name, token mark, tokens left and a one-line status that never wraps and is never clipped: `scrollWidth <= clientWidth` on the status at the narrowest wide layout (761 px viewport) and at 1280 px. On wide layouts the plate has two rows (name and tokens on top, the status under them beside the avatar) so the status has the plate's full text width.
- **Phone fit** (this overrides the two-toast slot of `game-feel` on phones only; design challenge attempt 2):
  - **No reserved toast row:** at 390 × 844 there is no reserved toast row. Toasts show one at a time (the newest replaces an older one, and a refusal outranks a take), anchored absolutely in the gap directly under the board.
  - **The toast fits the gap:** it covers no cell and no nameplate, and nothing moves when it appears or leaves. Phone toasts are one line (about 32 px). A message that would wrap uses a short form (for example "D3 is already taken" for the cell-taken refusal; keep the full text in the accessible announcement).
  - **Give the height to elements, not gaps:** phone avatars grow to about 80 px, so nameplates are about 94 px, within the existing 96 px cap, and the Match tile in the scoreboard row is 64 px. The remaining spare spreads evenly between the rows (`align-content: space-evenly`, about 39 px per gap).
  - **Measured honestly:** at 390 × 844 mid-game with no toast, no empty vertical strip across the column (between consecutive visible elements, the top and the bottom included) is taller than 56 px, and the bottom gap is at most 48 px. Replace the `bottomBand` helper's rule that counted the toast slot as visible, and count only boxes that paint something (a transparent wrapper is not content).
  - The game fits without vertical scrolling mid-game and with the end card shown. The board frame does not move when a toast appears or leaves.
  - Wide screens keep the reserved two-toast slot.
- **Keep:** the avatar faces and reactions, CSS-only materials, solid base colours under shading, 4.5:1 against the worst gradient stop, the reserved toast slot on wide screens, the end sequence (U10) with skip by tap or key, tile names on demand, the one-panel home, the stylesheet tests (shorthands and longhands, at most 700 ms only for the end sequence) and the scoped filter ban, every storage key, the StrictMode-safe bot scheduling and port 5493.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin.
- **Browser tests:**
  - they fix the page's randomness through `addInitScript`, and turn motion on only where a scenario says so;
  - they never depend on which tile the bot takes, and bot games use Easy or Normal with up to 10 seconds for the bot's reply;
  - every layout rule is checked at the default wide viewport and at 390 × 844;
  - motion checks are deterministic: `getAnimations()`, MutationObserver records, and seeded saves with Continue;
  - pixel checks take `locator.screenshot()` and decode it in the page with `createImageBitmap` and a canvas, with no new package;
  - **Theme checks without replaying games:** check each theme and variant by switching `data-palette` and `emulateMedia({ colorScheme })` on one seeded position (a saved game with Continue), not by replaying games per theme. Give long tests explicit `test.setTimeout`.

## Acceptance

- Unit (`npm run test:unit`):
  - the board model marks legal, faded and last-take cells, the pop order, the mover's colour and badge mark, for hand-built states in both modes. Nothing pops, fades or glows on the bot's turn, with highlights off, or at the end;
  - for every theme (`walnut`, `seaglass`, `clear`) and variant (light, dark), the theme tests check:
    - every text pair in `TEXT_PAIRS` and every material stop in `MATERIALS` at 4.5:1;
    - each player's ring colour at 3:1 against the `--well` token (not the frame's wood tokens), and the whose-turn stripe likewise;
    - that each player colour and the ground stay distinguishable, and that the two player colours differ in hue as well as lightness, by a CIELAB colour difference (ΔE*ab, CIE76) of at least 25;
  - no theme uses the old `#2c5a60`, `#a63b2b` or `#d97706`;
  - the settings round-trip the colour theme, older settings load as `walnut`, and every storage key stays as `persistence.test.ts` pins it;
  - the scoreboard model gives each seat's score, the draws text (hidden at zero) and the accessible name, in both modes;
  - the stylesheet test keeps every animation and transition under 400 ms except the end sequence (at most 700 ms), checks the pop's maximum delay plus maximum duration under 400 ms, finds no loops and keeps the filter ban.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them:
  - `home-screen`, `start-from-home`, `match-screen`, `scoreboard`, `seats-turn`, `opening-take`, `legal-turn`, `legal-tiles`, `move-highlight`, `colour-themes`, `tile-names`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `end-sequence`, `two-player-match`, `sitting-score`, `starter-alternates`, `sound-toggle`, `dark-theme`, `light-theme`, `phone-layout`, `keyboard-play`, `avatar-reactions`, `table-materials` and `toasts-clear-board`;
  - `move-highlight` measures, for each theme in light and dark, at the wide viewport and at 390 × 844, with the rendered pixels at `deviceScaleFactor: 2`:
    - each playable tile's ring has at least 3:1 contrast against the board surface around it. Ring pixels are sampled at the ring's mid-width, and well pixels from the bare inlay padding away from any halo or shadow. Use a seeded position where faded or taken tiles sit next to the sampled rings, so bare well exists right beside them;
    - playable and faded tiles differ in mean lightness by at least 12 L*, comparing the playable-set mean with the faded-set mean for each terrain present in both sets;
    - with motion on, the pop plays once in `data-pop-order` order, within 400 ms, when a person's turn starts, and not on the bot's turn;
    - in a two-player game, the pop replays on the next turn for every legal tile, including one that was legal on the previous turn;
  - `dark-theme` and `light-theme` run their contrast checks for every theme;
  - `colour-themes` switches between the three themes from the menu and from Settings, checks that the root's `data-palette` and the colours change, that the choice survives a reload with no flash of another theme (the attribute is set before the app script runs), and that no pop-up picker appears on a first visit;
  - `phone-layout` runs at 390 × 844 and checks the 48 px bottom rule mid-game, the end state without scrolling, the scoreboard row as the top row with the menu button at its end, and 44 px targets;
  - `full-match` and `two-player-match` fail after 20 takes.

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
