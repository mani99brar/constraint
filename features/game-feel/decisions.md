# Decisions: game-feel

From the grill session of 2026-10-04 with the operator.

## Decisions

- "Gamify" means feel only, and subtle. Consequence: the lane adds no achievements, badges, streaks, unlocks, levels, callouts ("3 in a row!") or celebration text. The game gets its character from materials, motion and the avatars' reactions. PRD v1.2 lists achievements, streaks, unlockables and hinting callouts as non-goals.
- One home screen replaces the title, mode and difficulty screens (PRD S1, E1). Consequence:
  - the home screen has a hero (a drawn "Constraint" wordmark over the board tray, with both avatars), Continue when a game is saved, a Versus bot card with an Easy / Normal / Hard switch and a Play button, a Two players card with a Play button, a compact results strip, and How to Play and Settings;
  - one tap on Play starts a game;
  - the switch remembers the last difficulty (Normal at first);
  - `ModeScreen.tsx` and `DifficultyScreen.tsx` go, and the browser scenarios `title-screen`, `mode-choice` and `new-game` are replaced by `home-screen` and `start-from-home`.
- The avatars react only to what just happened (PRD U9). Consequence:
  - the player to move looks ready, and the bot thinks while it chooses;
  - a player nods on their own take and winces when their tap is refused;
  - the waiting player glances at the other one's take;
  - the winner shows the won face with a small bounce, and the other player the lost face.

  No reaction depends on the position, so none hints at a threat. The reaction is a pure function of the last event and the mode, with a unit test proving that two different boards with the same last event give the same reactions.
- The art gets a "tabletop materials" finish on the existing theme (PRD U1). Consequence:
  - the terrains, emblems, tray, avatars and palette stay;
  - one light source from the top left and soft shadows;
  - a wood-grain tray on a felt table;
  - tiles with a slight edge and depth;
  - bevelled tokens that drop and settle;
  - shaded avatars;
  - the same materials carry onto the home hero, the wordmark, the play cards and the seat nameplates.

  The light and dark themes each get their own material tones.
- Two problems seen in the build of 2026-10-04 are fixed (PRD U2, U3). Consequence: toasts never cover a tile, at wide and phone sizes. On a phone, the seats become compact nameplates, each at most 96 px tall at 390 × 844, instead of tall boxes with empty space.
- PRD U8 is unchanged. Consequence: every animation and reaction stays under 400 ms, never loops, never blocks input and is off under reduced motion. The win moment is the won face with its bounce plus the existing stroke, with no confetti or longer sequence.
- One feature, `game-feel`, with one lane, `web`, which owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Consequence: the rules, `@okiya/game` and `@okiya/bot` are unchanged.

- After design challenge attempt 1, the operator accepted its findings. Consequence: the task now says that
  - each avatar has a resting face (`data-expression`: `to-move` or `thinking` for the player to move, `idle` for the waiting player, `won`/`lost` at a win, `idle` for both at a draw) and a one-shot motion on top (`data-reaction`):
    - a take gives the taker `nod` and the other seat `glance`;
    - a refused tap gives that player `wince`;
    - a win gives the winner `bounce`;
    - each event is replayed through a counter key, and the start or a resumed game is no event;
  - every material is drawn in CSS with no SVG `<defs>`, and tokens and avatars keep solid base colours under their shading;
  - text over a material meets 4.5:1 against its worst gradient stop, and the contrast helper and theme tests check those stops;
  - toasts get a fixed slot sized for two outside the board, the board never moves, and the end state fits at 390 × 844;
  - the token drop stays inside its cell and takes no taps;
  - the motion test checks the animation longhands, and the filter ban is scoped to blur, backdrop filters and board cells.

## Assumptions

- The remembered difficulty is a new field in the settings stored under `okiya.settings`. Older settings without it load as Normal. Every storage key stays as `persistence.test.ts` pins it.
- When a game is saved, the play cards say that starting a game replaces it, as New game did. The results strip keeps its reset button, disabled until a bot game was counted.
- The starter still alternates from the last game played (`starter.ts`), the first game in a browser is random, and Play again swaps the starter.
- The bot keeps Player 2's avatar with no per-difficulty look. The seat name still says the difficulty ("Bot · Normal").
- Rendering a screen never produces duplicate `id` attributes; with CSS-only materials no new ids are needed.
- Materials stay static: CSS gradients and box-shadows. Nothing uses `filter: blur(` or `backdrop-filter`, and no filter applies to board cells.
- The synthesized sounds may be refined (for example a wooden click when a token lands), within PRD E4: Web Audio only, with mute respected.
- How to Play keeps its pages and text, and its diagrams take on the new tile finish through the shared tile art.
- Browser tests run under reduced motion except where a scenario turns motion on (`avatar-reactions`, and the motion checks kept in `seats-turn` and `legal-turn`). Every layout rule is checked at a wide and at a 390 px viewport.
- No dependencies are added, and no image, font or audio files. All art is original inline SVG or CSS, never imitating Okiya's art or branding.

## Deferred

- Achievements, streaks, unlockable token sets or board frames, and any stored progress beyond the results by difficulty.
- Reactions that depend on the position (a worried face at a threat), and callouts of threats.
- A per-difficulty look for the bot, a third avatar, player names and an avatar choice.
- A celebration longer than 400 ms (confetti, a sequenced win moment).
- Pushing `main` to GitHub Pages: the operator decides when.
