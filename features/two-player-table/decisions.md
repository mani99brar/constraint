# Decisions: two-player-table

From the grill session of 2026-10-04 with the operator.

## Decisions

- The rules stay `docs/game-spec.md` v1.0, and `docs/prd.md` v1.1 (written in this session, with the operator's approval) is the product authority for everything below: §5.8 is new; S1, S2, R2, R4, I1, I3, L2, U1–U3, U6, U7, E2 and E5 changed. Consequence: no lane changes `packages/game` or `packages/bot`; every change is in `apps/web` and `tests/e2e`.
- Clarity & feedback are in. Consequence: the lane delivers all of these:
  - a Match card next to the board showing the last tile with its art and two emblem names ("Any edge tile" at the opening);
  - a legal-tile glow in the colour of the player to move, without the hollow circle now drawn over the tile art;
  - the other side's take marked on the board and announced in a toast ("Bot took D3, Desert–Star");
  - a refusal toast that clears when the turn changes;
  - the end of the game shown once, by the end screen and the seats, with no end toast;
  - a phone layout without the empty bands above and below the board.
- Two players on one device (PRD §5.8) are in. Consequence: New game asks for a mode first, either Versus bot (then a difficulty) or Two players. A two-player game has no bot, no pause and no hand-off screen. Player 1 is engine player `A` and Player 2 is `B`.
- Seats sit beside the board on wide screens (Player 1 left, Player 2 right) and above and below it on a phone, with all text reading the same way up. Both modes use them. Consequence: there is one match screen. The seats replace the top bar's turn text and token counts, and the top bar keeps only the menu button (and the Match card on a phone).
- Whose move it is shows in several ways at once (PRD I3). Consequence:
  - the seat to move is lit in its player's colour and labelled "Your move", "Bot is thinking" or "Player 1's move";
  - the other seat is dimmed;
  - the board frame takes the active colour on that player's side;
  - each change is announced through an `aria-live` region.
- There are two fixed avatars, one for Player 1 and one for Player 2, original SVG drawn in code by the worker, with no picker and no names. Each has four expressions: idle, to move, won and lost. Consequence: the seats are named "Player 1" and "Player 2", or "You" and "Bot · <difficulty>" in a bot game, where the bot takes Player 2's avatar.
- The score of a sitting (PRD P3) counts each seat's wins and the draws since New game. Consequence:
  - Play again keeps it and swaps the starter, and leaving to the title screen or starting a New game resets it;
  - it is saved with the unfinished game and restored on Continue;
  - it reads "Player 1 2 – 1 Player 2 · 1 draw", or "You 1 – 2 Bot";
  - only bot games count in the results by difficulty.
- One feature with one lane, `web`, which owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Consequence: the run also carries:
  - the animations tied to the above (the taken tile moving into the Match card, the seat lighting and dimming, a stroke across the winning shape, the avatar expressions), all under 400 ms, never blocking input and off under reduced motion (PRD U8);
  - How to Play as short pages whose diagrams use the real tile art, in wording that fits both modes (PRD E2).
- Take preview, undo and the end-of-game replay are out, by the operator's first answer. Consequence: no screen shows the opponent's possible replies, takes are final, and PRD I2 (no log or history panel) stands.

## Assumptions

- The feature's one lane is `web` (`web-task.md`), and `feature.json` names `docs/prd.md` as its `prd`.
- In a bot game the human is Player 1 (`HUMAN = 'A'` stays). The first game's starter is random, and Play again alternates it in both modes.
- A v1.0 save (game log and difficulty) loads as a bot game with a 0–0 score. A malformed or illegal save is discarded without throwing. The results-by-difficulty storage keys do not change.
- The engine's `A` and `B` keep their token colours and marks (blue circle, red diamond), and each seat uses its player's.
- The avatars do not loop an idle animation, because PRD U8 caps animations at 400 ms. An expression changes with a transition under 400 ms.
- With highlights off, nothing glows, but the seats, the Match card and the turn announcements still show whose move it is and what to match.
- The board stays one Tab stop with arrow keys (PRD U7). The seats are not interactive. In two-player games, cell names use the seat ("B3, Player 2's token").
- The bot's pause (`BOT_DELAY_MS`) and difficulties are unchanged. Browser tests of bot games use Easy or Normal and allow up to 10 seconds for the bot's reply. Two-player browser tests drive both seats and never depend on the bot.
- No lane adds dependencies or files other than source and tests: no image, font or audio files. All art stays inline SVG or CSS, original, and never imitates Okiya's art or branding.
- The 14 existing browser scenarios stay, adjusted for the seats, and four are new: `mode-choice`, `seats-turn`, `two-player-match` and `sitting-score` (`policy.json`).
- The web client keeps port 5493 and both themes. Text, including the seat labels on their lit and dimmed backgrounds, meets 4.5:1 contrast.

## Deferred

- A turning-point note on the end screen (the solver's `analyzeTake` values make it possible without a bot change), the daily board and puzzles.
- A two-game series or a match to a target score, and a lasting head-to-head record.
- An avatar choice, player names, a third avatar for the bot and a face-to-face orientation for a device lying flat.
- One-time coach tips during the first games and a guided tutorial game.
- A finer bot ladder or a perfect Hard opening. Measured 2026-10-04: Easy won 3 of 60 against Normal, and Normal won 5 of 60 against Hard.
- Deleting `packages/rules`, `packages/content`, the old bot code and their tests (the cleanup left over from `pure-okiya`).
- Online play.
