# Task: web

## Goal

Turn the match screen of `apps/web` into a table for one or two people. New game first asks for a mode: Versus bot (then a difficulty) or Two players on one device. In both modes a seat sits beside the board for each player, each with its own avatar drawn in code. The seats sit above and below the board on a phone. They show whose move it is, each player's tokens left and the score of the sitting. A Match card next to the board shows the tile to match. Feedback is clearer: the glow is in the colour of the player to move, the bot's takes are announced, stale refusals clear, the end is shown once, and animations stay short. How to Play becomes short pages drawn with the real tile art. The rules and the bot do not change.

## Context

- Read `docs/prd.md` v1.1, which governs the interface: §5, especially the new §5.8 (Two players), I1, I3, U1–U3, U6, U7, E2 and E5. Then read `features/two-player-table/decisions.md`. The rules are `docs/game-spec.md` v1.0.
- The current client in `apps/web/src` is the tabletop interface on `@okiya/game`. It has the title screen, difficulty screen, `MatchScreen`, `Board`, `TopBar`, `EndScreen`, toasts, the menu dialog, How to Play (`howto.ts` with `HowToPlay.tsx`), the save (`save.ts`), results by difficulty, settings, synthesized sound and both themes. Its browser tests are in `tests/e2e/` (`game.spec.ts`, `layout.spec.ts` and `helpers.ts`). Keep its look and every part these changes do not replace.
- The engine is `@okiya/game`: `newGame`, `legalTakes`, `validateTake`, `take`, `tileAt`, `tokenAt`, `LINES`, `SQUARES`, `EDGE_CELLS`, `gameLogOf`, `parseGameLog` and `replayGame`. Its players are `A` and `B`: Player 1 is `A` and Player 2 is `B`. In a bot game the human is Player 1 (`HUMAN = 'A'`). The bot is `chooseTake(state, { difficulty })` from `@okiya/bot`, unchanged.
- What the current build gets wrong (seen in screenshots on 2026-10-04):
  - the tile to match appears only as two chips in the top bar;
  - legal tiles carry a hollow circle drawn over their art;
  - the bot's take is easy to miss;
  - a refusal toast stays four seconds into the next turn;
  - the end result appears three times (top bar, toast and end panel);
  - at 390 px the top bar wraps to two rows and the board floats between empty bands.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/`, `features/` or `CLAUDE.md`. Add no dependencies and no image, font or audio files.
- All art, the two avatars included, is original inline SVG or CSS drawn by you. It never imitates the published Okiya game's art or branding, and the game's name stays Constraint.
- Modes and seats:
  - New game shows Versus bot and Two players. Versus bot leads to Easy, Normal or Hard, then the board; Two players leads straight to the board.
  - A two-player game has no bot, no bot pause and no hand-off screen.
  - The first game's starter is random. Play again starts a new game in the same mode with the other player starting, and keeps the score.
- Where information goes:
  - **Seats:** Player 1 on the left and Player 2 on the right on wide screens, above and below the board on a phone; all text reads the same way up. Each seat shows:
    - its avatar;
    - its name ("Player 1" and "Player 2", or "You" and "Bot · Easy/Normal/Hard");
    - its token mark (the existing blue circle and red diamond);
    - its remaining tokens out of 8;
    - its score in the sitting.
  - **Whose move:** the seat to move is lit in its player's colour and labelled "Your move", "Bot is thinking" or "Player 1's move". The other seat is dimmed, the board frame takes the active colour on that player's side, and each change is announced through an `aria-live` region. Colour is never the only signal.
  - **Avatars:** two fixed avatars, one for Player 1 and one for Player 2, with no choice and no names. In a bot game the bot uses Player 2's. Each has four expressions: idle, to move, won and lost. They have no looping idle animation; an expression changes with a transition under 400 ms.
  - **Match card:** the last tile with its terrain scene, symbol emblem and both names, next to the board ("Any edge tile" at the opening). On a phone it sits in the top bar row beside the menu button.
  - **Board:**
    - each tile shows its art, and a taken cell shows its token;
    - with highlights on, the legal tiles glow in the colour of the player to move, without any mark drawn over the tile art;
    - the last take is marked until the next one;
    - at the end, a stroke runs across the winning shape's four cells.
  - **Top bar:** only the menu button, plus the Match card on a phone.
  - **Toasts:**
    - a refused take with its reason, naming the tile and the last tile ("Desert–Moon matches neither Forest nor Star"), which clears when the turn changes;
    - in a bot game, the bot's take ("Bot took D3, Desert–Star").

    There is no take toast in a two-player game and no end toast.
  - **End screen:**
    - it names the result and how it happened (line, square, blockade or a full-board draw), naming the seat in a two-player game ("Player 2 wins by a square");
    - the winner's avatar shows "won" and the other "lost";
    - it offers Play again and Title screen.
  - **Menu dialog:** unchanged (resume, How to Play, highlight and sound settings, quit to title keeping the saved game).
- The score of a sitting:
  - it counts each seat's wins and the draws from the first game after New game;
  - Play again keeps it, while leaving to the title screen or starting a New game resets it;
  - it reads "Player 1 2 – 1 Player 2 · 1 draw", or "You 1 – 2 Bot";
  - only bot games count in the results by difficulty, whose storage keys do not change.
- Saves:
  - save the unfinished game after every take: its game log, mode, difficulty in a bot game, and the score;
  - restore it on Continue with `parseGameLog` and `replayGame`;
  - a save written by the current build (a game log and a difficulty) loads as a bot game with a 0–0 score;
  - a malformed or illegal save is discarded without throwing.
- Animations: the taken tile moves into the Match card, the seats light and dim, the stroke is drawn and the avatar expressions change. Each stays under 400 ms, never blocks input and is off under reduced motion (PRD U8). Keep the existing reduced-motion switch in `styles.css`.
- How to Play: short pages (taking a matching tile, the opening, lines and squares, blockade and the full-board draw) with diagrams drawn with the real tile art. The wording fits both modes. It still opens by itself on the first visit, from the title screen and from the menu, closes with Escape or its button and returns focus.
- Keyboard and accessibility:
  - the board stays one Tab stop with arrow keys and Enter or Space;
  - the seats are not interactive;
  - cell names use the seat in a two-player game ("B3, Player 2's token") and "your token" or "bot's token" in a bot game;
  - text, seat labels on lit and dimmed seats included, meets 4.5:1 in both themes.
- Keep the StrictMode-safe bot scheduling with `BOT_DELAY_MS`, the sound effects and mute, the highlight setting, both themes and port 5493.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin.
- Browser tests:
  - they fix the page's randomness through `addInitScript`, read tiles, tokens and seats from the page, and never wait on an animation;
  - they never depend on which tile the bot takes;
  - bot games use Easy or Normal, never Hard, and allow the bot's reply up to 10 seconds;
  - two-player tests drive both seats themselves.

## Acceptance

- Unit (`npm run test:unit`):
  - the seat model gives, for hand-built states in both modes, each seat's name, token mark, tokens left, score, which seat is lit and its label ("Your move", "Bot is thinking", "Player 1's move", "Player 2's move"), and the avatar expression (idle, to move, won, lost);
  - the Match card model gives the last tile's terrain, symbol and names, and "Any edge tile" at the opening;
  - the board model:
    - every cell has its tile or token;
    - the glowing cells are exactly `legalTakes`, in the colour of the player to move;
    - no cell glows with highlights off;
    - the last-take mark follows the latest take;
    - the winning shape's cells are marked at the end;
    - cell names use the seat in a two-player game;
  - the announcement text names the bot's take ("Bot took D3, Desert–Star") and gives the `aria-live` line for each change of turn in both modes;
  - the toast queue drops a refusal when the turn changes, makes no take toast in a two-player game and no end toast in either mode;
  - every refusal code of `@okiya/game` keeps readable text naming the tiles involved;
  - the end-screen text covers a win and a loss by line, square and blockade, and the full-board draw, in a bot game, and each seat winning by each and the draw in a two-player game;
  - the score module counts wins and draws per seat, is kept by Play again and is reset by New game and by leaving to the title screen;
  - the save module:
    - round-trips a bot game and a two-player game with their mode, difficulty and score;
    - loads a save in the current build's format as a bot game with a 0–0 score;
    - discards a malformed or illegal save without throwing;
  - the results by difficulty count a finished bot game and never a two-player game;
  - the next game's starter is the other player, in both modes;
  - How to Play has its pages in order, every diagram agrees with the rules (`howto.test.ts`), and no page assumes a bot opponent only;
  - both avatars render each of their four expressions, and the reduced-motion switch in `styles.css` still turns off every animation and transition (`motion.test.ts`).
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them:
  - existing scenarios, adjusted to the seats: `title-screen`, `new-game`, `match-screen`, `opening-take`, `legal-turn`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `starter-alternates`, `sound-toggle`, `dark-theme`, `phone-layout` and `keyboard-play`;
  - new scenarios: `mode-choice`, `seats-turn`, `two-player-match` and `sitting-score`.

  `phone-layout` runs at a 390 px viewport, and `dark-theme` emulates the dark colour scheme. `full-match` and `two-player-match` fail after 20 takes.

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
