# Decisions: calm-table

From the grill session of 2026-10-04 with the operator. It follows their feedback on the deployed `game-feel` build:
- "add gaps in tiles, too clustered";
- "remove the tile sliding animation";
- "better game end animations";
- "better BG";
- "the two play buttons ... seems redundant";
- "add an overlay of the player color".

## Decisions

- **End of the game** (PRD U10, with one exception to U8): a short sequence on the board, at most 700 ms in all, that "shouldn't feel long and annoying". Consequence:
  - a line or square: the four winning tokens lift one after another, the stroke is drawn through them and the other cells dim;
  - a blockade: the Match card shows that no tile matches and the remaining tiles grey out;
  - a draw: the board settles evenly.

  The result card and Play again appear at once, beside the board on wide screens and below it on a phone, never covering it, and work from the first frame: nothing waits for the sequence. Play again and Home keep fixed places. Any tap or key skips the sequence, and it is off under reduced motion.
- **Background** (PRD U1): a calm ground. Consequence:
  - warm paper or linen in the light theme and desaturated slate ink in the dark theme, on both the home screen and the game;
  - one soft radial glow behind the board, a gentle vignette and static grain of 3% or less;
  - the felt and the repeating diagonal hatching are removed;
  - accent colours (buttons, switches) are retuned to the new ground.
- **Home** (PRD S1, E1, E5): one play panel. Consequence:
  - an "Opponent" switch with Bot and Friend;
  - Easy / Normal / Hard shown only while Bot is chosen (hidden, not disabled);
  - one Play button labelled with the choice ("Play · Normal bot", "Play · with a friend");
  - both choices remembered (Bot and Normal at first), and Continue above the panel when a game is saved;
  - the tagline box goes, the results become one quiet line, and Reset moves into the Settings dialog;
  - at 390 × 844 the home fits without scrolling, and the wordmark never breaks inside the word.
- **Legal tiles** (PRD R2, I2, E3): no outlines. Consequence:
  - with highlights on, the matching tiles keep full brightness, lift slightly and carry a light wash of about 15% of the mover's colour, while the other free tiles fade to about 55%;
  - brightness and lift carry legality; the colour only adds whose turn it is, so Player 2's red never reads as "forbidden";
  - the last take is marked by one warm tint on its cell instead of the purple dashed box;
  - with highlights off, nothing fades, lifts or carries a wash.
- **Game screen** (PRD I1, U1, U2, U8): thinned out. Consequence:
  - tiles become separate raised pieces with a gap of about 12% of a tile on the board and the same padding around it;
  - the tile flight into the Match card is removed, and the card's contents crossfade in place, under 200 ms;
  - tile names leave the tiles: they show on hover, keyboard focus and a long press, stay in every accessible name, and a Tile names setting (off by default) shows them on all tiles;
  - the seats become slim nameplates (avatar, name, token mark, tokens left);
  - the score of the sitting shows once, as one line between the nameplates, replacing the corner pill and the per-seat "Wins";
  - the A–D and 1–4 labels get lighter and smaller.
- **One feature, `calm-table`, with one lane, `web`,** which owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Consequence: the rules, `@okiya/game` and `@okiya/bot` are unchanged. The PRD is v1.3.

## Assumptions

- Everything decided in `features/game-feel/decisions.md` that this file does not change stays:
  - the avatar faces and reactions with their two layers (`data-expression`, `data-reaction`, `data-reaction-key`);
  - CSS-only materials with no SVG `<defs>`;
  - solid base colours under shading;
  - 4.5:1 against the worst gradient stop;
  - the reserved toast slot;
  - the token drop inside its cell;
  - the stylesheet test of shorthands and longhands, and the scoped filter ban.
- The remembered opponent and the Tile names setting are new fields in the settings stored under `okiya.settings`. Older settings load as Bot, Normal and names off, and every storage key stays as `persistence.test.ts` pins it.
- The end sequence is pure CSS (keyframes with `animation-delay` for the one-after-another lift), keyed by the game's end so it plays once. It never delays the result card's buttons, which take taps at once. The stylesheet test allows exactly the end-sequence rules to total up to 700 ms (each animation's delay plus duration) and keeps the 400 ms limit everywhere else.
- A long press is a pointer held for 450 ms or more on a tile. It shows the name without taking the tile; a normal tap still takes it.
- The wash and the fade never hold text: tile names, when shown, sit on a solid plate that meets 4.5:1.
- The red of Player 2 and the blue of Player 1 stay the token colours. The wash uses them at about 15% over the tile art.
- These loose ends from `game-feel-001`'s review are fixed too:
  - the dead `Logo` component and `.felt` styles;
  - the phone game's empty band at the bottom, with its no-empty-band check restored;
  - the end sequence shown with motion on in a test;
  - a test that sees Reset enabled and presses it (now in Settings).
- Browser tests keep the rules of `game-feel`:
  - fixed randomness;
  - motion only where a scenario turns it on;
  - every layout rule at a wide and a 390 × 844 viewport;
  - deterministic motion checks: a seeded save near the end with Continue, `getAnimations()`, and MutationObserver records.
- No dependencies are added, and no image, font or audio files.

## Deferred

- Achievements, streaks, unlocks and position-aware reactions (still non-goals).
- A per-difficulty bot look, player names and an avatar choice.
- A celebration longer than 700 ms or one that covers the board.
- Pushing `main` to GitHub Pages: the operator decides when.
