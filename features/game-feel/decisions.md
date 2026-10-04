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

## Assumptions

- The remembered difficulty is a new field in the settings stored under `okiya.settings`. Older settings without it load as Normal. Every storage key stays as `persistence.test.ts` pins it.
- When a game is saved, the play cards say that starting a game replaces it, as New game did. The results strip keeps its reset button, disabled until a bot game was counted.
- The starter still alternates from the last game played (`starter.ts`), the first game in a browser is random, and Play again swaps the starter.
- The bot keeps Player 2's avatar with no per-difficulty look. The seat name still says the difficulty ("Bot · Normal").
- Shared SVG patterns and gradients are defined once per page (for example one hidden `<svg><defs>`) or drawn in CSS. Rendering a screen never produces duplicate `id` attributes.
- Materials stay static: SVG patterns, gradients and box-shadows. Nothing on the board uses `filter: blur()`, `backdrop-filter` or a filter repeated on all 16 cells.
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
