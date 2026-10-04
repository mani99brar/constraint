# Decisions: final-polish

From the grill session of 2026-10-04 with the operator, after their feedback on the deployed calm-table build:
- "the move highlights I thought I said a highlight with players color with the pop up motion and stuff";
- "The UI colors suck and doesn't match";
- "Score placement can be better like put it near the Match tile".

The operator calls it "a last and final run".

## Decisions

- **Move highlights: pop and glow** (PRD R2), and "make sure the highlight is enough to show the active tiles". Consequence:
  - when a turn starts, the playable tiles pop up one after another, a springy lift under 400 ms in all;
  - they stay raised with a soft halo, a 2–3 px ring in the mover's colour, a tint of about 30% of it, and a corner badge with the mover's token mark (ring for Player 1, diamond for Player 2);
  - the other free tiles fade back;
  - the ~15% wash of calm-table is replaced.
- **Highlight visibility is measured, not judged.** Consequence: a browser test in every colour theme, light and dark, at wide and 390 × 844, reads rendered pixels and checks that:
  - each playable tile's ring has at least 3:1 contrast against the board surface around it (WCAG 1.4.11);
  - playable and faded tiles differ in mean lightness by at least 12 L* (CIELAB).

  The theme tests also check the ring colours against the frame surface tokens at 3:1.
- **Colour themes** (PRD U5, E3): "multiple color themes and have a switch option in the menu, the default would be A. No pop ups for selection." Consequence:
  - **Walnut and parchment** (the default):
    - light: parchment ground `#F3EBDD`–`#E8DCC7`, walnut buttons `#6B4A30` with cream text, ink-brown text `#2B2118`;
    - dark: warm charcoal ground `#1E1A16` with cream text;
    - players: indigo `#34509A` (dark `#9DB2F0`) and terracotta `#B4533A` (dark `#F0A07F`).
  - **Sea glass and stone**:
    - light: pale stone ground `#EEF0EC`, a driftwood frame, deep teal buttons `#1F5F5B`;
    - dark: teal-ink ground `#14201F`;
    - players: teal-navy `#2E4A8A` and amber `#C27A1A`.
  - **Clear**: high contrast, a near-white or near-black ground, stronger rings and text.

  Each theme has a light and a dark variant that follow the system colour scheme. Within a theme, the ground, frame, tiles (re-tuned to the theme's saturation, keeping each terrain's identity), nameplates, buttons and both players come from one family. The Theme choice lives in the menu dialog (also opened as Settings from the home screen), is remembered, and has no first-run picker. The hex values are starting points that the worker may adjust to pass contrast; the families and the default are fixed.
- **Last take** (PRD I2): a soft ring in the last mover's colour on its cell, replacing the mustard tint.
- **Scoreboard row** (PRD U2, I1, P3). Consequence:
  - above the board sits `[Player 1's score] [Match card] [Player 2's score]`, each score on its player's side in that player's colour with its token mark, and the draws small under the Match card;
  - on desktop the Match card moves to the top centre, out from under Player 1's nameplate;
  - on a phone the scoreboard row is the top row, with the menu button at its end;
  - the floating score line goes.
- **Fixes:** the phone empty band at the bottom (at most 48 px at 390 × 844 mid-game with no toast), and the status inside a nameplate ("Player 2's move") stays on one line.
- One feature, `final-polish`, with one lane, `web`, which owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`. The rules, `@okiya/game` and `@okiya/bot` are unchanged. The PRD is v1.4.

- After design challenge attempt 1, the operator applied all its rulings, choosing the pale inlay. Consequence:
  - **Phone:** toasts show one at a time in a one-toast slot, the spare height is spread evenly, and the band is measured honestly (an empty slot counts as empty; no empty strip over 56 px; bottom gap at most 48 px).
  - **Pale inlay:** in the light variants, the board well between the tiles is a pale tone of the theme's ground, and wood stays on the outer frame. One colour per player serves as token, score text and ring, with no pastel or second ring colour.
  - **The pop** restarts every turn (keyframe names alternating by parity), with static per-order delays, and is checked in two-player games too.
  - **No-flash script:** a precise release-test allowance for the `okiya.settings` literal in `index.html`, walnut tokens on a bare `:root`, and a unit test of the script.
  - **Pixel checks** sample at 2×, at the ring's mid-width and on bare inlay, and compare L* per terrain.
  - **Desktop:** the Match card is a compact strip at most 64 px tall, and the board frame stays at least 500 px tall at 1280 × 720.
  - **Theme checks** switch the palette on one seeded position, with explicit test timeouts.
  - **Nameplate status** is checked for clipping at 761 px and 1280 px.
- After design challenge attempt 2, the operator applied its phone layout fix and P2 rulings. Consequence:
  - **Phone toasts:** no reserved toast row. Toasts show one line at a time, anchored in the gap under the board without covering anything.
  - **Phone height:** the spare height goes to bigger phone avatars (about 80 px, nameplates about 94 px) and a 64 px Match tile, and the rest spreads evenly, so no empty strip exceeds 56 px.
  - **Ring reference:** the ring is checked at 3:1 against the `--well` token.
  - **Whose-turn stripe:** it moves from the wood to the well's edge on the mover's side.
  - **Player colours:** they also differ by ΔE*ab of at least 25.
  - **Nameplates:** two rows on wide layouts.
  - **CSS cascade traps:** spelled out for the pop delays and the dark tokens.
  - **Halo spread:** at most a third of the gap.
- After design challenge attempt 3, the operator applied its rulings. Consequence:
  - **No board stripe:** the whose-turn stripe is dropped from the board. Whose turn shows through the mover-coloured pop and glow, the badge, the lit nameplate and the announcement.
  - **Player 2 colours:** in the light variants, Player 2 may darken: terracotta to reach 4.5:1 as score text, and Sea glass's amber to a burnt ochre (about `#9E5E0E`), kept distinct from the frame and desert colours.
  - **The pop:** owns the lift, with no competing cell transition, and fills backwards.
  - **Phone toasts:** one-line short forms per refusal kind, hidden once the game ends.
  - **Narrow nameplates:** the avatar shrinks to about 40 px at narrow wide widths.
  - **Ring sampler:** accepts only pixels matching `--well`.
- **Phone end screen: the layout glides** (operator's choice A). Consequence: at the final take, the phone column's rows ease into their ended places over about 250 ms, the board moving up about 30 px, while the end sequence plays. It is instant under reduced motion, both faces stay visible, and nothing covers the board.
- Standing permission for the rest of this run: challenge rulings that do not change what the player sees are applied and the run is resumed without asking. Anything visible (layout, colours, motion, cues) is asked first.

## Assumptions

- Everything `features/game-feel/decisions.md` and `features/calm-table/decisions.md` decided that this file does not change stays, including:
  - the avatar faces and reactions;
  - CSS-only materials with no SVG `<defs>`;
  - solid base colours under shading;
  - 4.5:1 against the worst gradient stop;
  - the reserved toast slot;
  - the end sequence (U10, at most 700 ms, with skip by tap or key);
  - tile names on demand;
  - the one-panel home;
  - the stylesheet tests and the scoped filter ban;
  - every storage key.
- The colour theme is a new field in the settings stored under `okiya.settings` (default Walnut and parchment; older settings load as it). It is applied as a `data-palette` attribute on the root element before the first paint (a small inline script in `apps/web/index.html` reads the stored setting), so no other theme flashes first.
- `theme.ts` holds every theme's light and dark tokens, and its stylesheet maps each to `:root[data-palette=…]` with the dark variant under `prefers-color-scheme: dark`. `TEXT_PAIRS`, `MATERIALS` and the new ring pairs are checked for every theme and variant.
- The pop plays when a person's turn starts (not on the bot's turn, when nothing pops, fades or glows), and only once per turn: a re-render does not replay it. It is CSS keyframes with `animation-delay` for the stagger, under the U8 limit of 400 ms in all, and off under reduced motion, where the tiles simply show raised.
- With highlights off, nothing pops, fades, lifts, glows or carries a tint. The badge and ring show only for legal tiles with highlights on.
- The red family of the old player 2 (`#a63b2b`) and the teal buttons and mustard last-take (`#d97706`) of the calm-table build are replaced in every theme.
- No dependencies are added, and no image, font or audio files. Pixel checks decode `locator.screenshot()` output in the page (`createImageBitmap` and a canvas), with no new package.

## Deferred

- An explicit light/dark/system appearance switch (themes follow the system scheme).
- More colour themes beyond the three.
- Pushing `main` to GitHub Pages: the operator decides when.
