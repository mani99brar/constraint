# Constraint: product requirements v1.1

Status: v1.1 of 2026-10-04. It adds two-player play on one device, the seats around the board, two drawn avatars and the score of a sitting to v1.0 of 2026-10-02, which replaced v0.3 and its fighter game of rules v0.2. The rules are unchanged. Companion document: `game-spec.md` v1.0, the rules. `paper-simulation.md` and `paper-test-01.md` document the retired fighter game and are kept as history only.

## 1. Authority

- `game-spec.md` is the authority for gameplay rules. This document never restates a rule differently; where it cites one, the spec section (§) governs.
- This document is the authority for the product: what is built, how it is presented and how it is delivered.
- The game follows the rules of Okiya (Bruno Cathala) and is published as **Constraint**, with its own tile theme (Forest, Water, Mountain, Desert × Sun, Moon, Star, Wave) and original art drawn in code. It never uses the Okiya name, art or branding. Internal package names keep `okiya`.

## 2. Product summary

A browser game for one or two people: one human plays Okiya's rules against a bot, or two people play each other on one device, on a 4×4 board of 16 illustrated tiles. Players take turns taking a tile that matches the last one and placing a token on its cell. Four tokens in a row, column or long diagonal, a 2×2 square, or leaving the opponent with no matching tile wins; a full board draws.

Goals:
- The rules exactly as in Okiya, not a variant of them.
- A finished, published-quality tabletop game: the board and the two seats beside it are the whole interface.
- A bot at three strengths, whose Hard level plays perfectly.
- Two people at one screen always see whose move it is and how their sitting stands.
- Reproducible games: a seed, the starting player and the takes replay any game.

Non-goals for v1: online play, rounds or a match to a target score, a lasting head-to-head record, player names or a choice of avatar, Okiya's optional variants, accounts, analytics, artist-made images and recorded audio.

## 3. Decisions

| Topic | Decision | Consequence |
| --- | --- | --- |
| Rules | Okiya's rules as written (spec v1.0), replacing the fighter game of v0.2 | No fighters, abilities, traps, recharge, rosters or hidden information. |
| Full board | A draw (spec §4) | The end screen, the score of a sitting and the results have draws. |
| Match | One game; the first starter is random, then it alternates (spec §5) | Play again swaps the starter; no rounds. The score of a sitting counts the games played in a row (§5.8). |
| Play mode | Versus bot, or two players on one device | No server; everything runs in the browser. A two-player game has no bot and no hand-off screen, because nothing is hidden. |
| Seats | One seat per player beside the board on wide screens, above and below it on a phone, in both modes | The seats replace the top bar's turn text and token counts. All text reads the same way up; there is no face-to-face orientation. |
| Avatars | Two fixed avatars, one for Player 1 and one for Player 2, drawn in code | No avatar choice and no names. In a bot game the human sits in Player 1's seat and the bot takes Player 2's avatar. |
| Bot | Easy, Normal and Hard; Hard plays perfectly after the opening | Hard is unbeatable whenever it can force a win or a draw. |
| Devices | Desktop first, responsive | Mouse and keyboard on desktop; the layout and tap targets also work on a phone. |
| Rendering | DOM and SVG with React | The board is readable by browser tests and screen readers. |

## 4. Users and experience

Players who know Okiya or are learning it, alone against the bot or two at one screen. They want the game to feel like the board game: a clear board, a last tile they can read at a glance, honest refusals, a bot that plays a real game, and, when two people share a screen, no doubt about whose move it is. Reading which tiles your take leaves your opponent, and steering them into a dead end, is the whole game.

## 5. Functional requirements

### 5.1 Starting a game

- **S1.** New game asks for a mode: Versus bot, then a difficulty (Easy, Normal or Hard), or Two players. It then shows the board at once: 16 tiles from a seeded shuffle (spec §2). The seed is generated and never shown.
- **S2.** The first game's starter is random; Play again after a finished game starts a new game in the same mode with the other player starting (spec §5) and keeps the score of the sitting.

### 5.2 Turns and rules

- **R1.** The rules engine implements spec §1–§4 completely: the edge opening, matching, the line and square shapes, the full-board draw, the blockade and their order.
- **R2.** On a human player's turn, only legal takes are possible. With highlights on, the legal tiles glow in the colour of the player to move.
- **R3.** An illegal take is refused with its reason, naming the tile and the last tile (for example "Desert–Moon matches neither Forest nor Star"), and does not end the turn.
- **R4.** The game ends on a line, a square, a blockade or a full board. The end screen says which and who won, naming the seat in a two-player game ("Player 2 wins by a square"), and the board marks the winning shape's four cells.

### 5.3 Information shown

- **I1.** Always visible: every tile with its terrain and symbol, every token with its owner, the last tile in a Match card next to the board, with its art and its two emblem names ("Any edge tile" at the opening), whose move it is, each player's remaining tokens out of 8 and the score of the sitting.
- **I2.** The last take stays marked on the board until the next one. No log or history panel exists.
- **I3.** Whose move it is never rests on colour alone: the seat to move is lit in its player's colour and labelled ("Your move", "Bot is thinking", "Player 1's move"), the other seat is dimmed, and each change is announced to screen readers.

### 5.4 Bot

- **B1.** In a bot game, the bot chooses one legal take per turn from the public state.
- **B2.** Easy looks one take ahead, Normal three, and Hard plays perfectly from the second take of a game on: its take always keeps the best game value available. At the opening Hard plays Normal's three-take search.
- **B3.** Every difficulty takes an immediate win. Easy otherwise picks any legal take; Normal and Hard avoid a take that lets the opponent win at once whenever another take exists.
- **B4.** The bot is deterministic for a given state and difficulty. Equal takes are broken by a value derived from the game's seed, so games vary.
- **B5.** A bot take returns within one second on a mid-range laptop, and is shown after a short pause so the player can follow it. Tests prove the bound by counting searched positions against a budget, not with a clock.

### 5.5 Games and saves

- **L1.** Every game has a seed. The engine is deterministic: the same seed, starter and takes always give the same states.
- **L2.** The unfinished game is saved in the browser after every take, as its game log (seed, starter, takes), its mode, the difficulty in a bot game and the score of the sitting, and restored on Continue. A malformed, illegal or old save is discarded safely; a save from v1.0 (a game log and a difficulty) loads as a bot game with a new score.

### 5.6 Presentation

- **U1. Tabletop.** The board and the seats are the whole interface: illustrated square tiles in a framed tray, with each terrain a scene and each symbol an emblem, round tokens in two player colours, and a seated avatar on each side, one fixed avatar for Player 1 and one for Player 2. The avatars show whose move it is and the result of the game through their expression. All art is original and drawn in code (inline SVG or CSS). Colour is never the only signal: tokens differ in shape or mark as well.
- **U2. Seats and top bar.** Each seat shows its avatar, its name ("Player 1" and "Player 2", or "You" and "Bot · Normal"), its token mark, its remaining tokens out of 8 and its score in the sitting. A slim top bar holds the menu button. During the bot's turn the board does not accept takes.
- **U3. Toasts.** Short, non-blocking notices for a refused take and for the other side's take ("Bot took D3, Desert–Star"). A refusal notice clears when the turn changes. The end of the game is shown by the end screen and the seats, once.
- **U4. Menu.** Resume, How to Play, the highlight and sound settings, and quit to title, which keeps the saved game.
- **U5. Themes.** Light and dark, following the system colour scheme. Text meets a 4.5:1 contrast ratio.
- **U6. Phone.** At a 390 px wide viewport the board, both seats, the Match card and the menu button fit without scrolling, and every tap target is at least 44 px.
- **U7. Keyboard.** Every tile and button is reachable by keyboard, and every cell has an accessible name, for example "B3, Water–Moon, legal take", "B3, your token" or, in a two-player game, "B3, Player 1's token".
- **U8. Motion.** Animations stay under 400 ms, never block input and are off under reduced motion.

### 5.7 Release

- **E1. Title screen.** New game, Continue when a game is saved, How to Play, results by difficulty and settings.
- **E2. How to Play.** A dialog of short pages, opened from the title screen and from the match menu, that explains taking a matching tile, the edge opening, the line and square shapes, the blockade and the full-board draw, with small board diagrams drawn with the tile art, in wording that fits both modes.
- **E3. Highlight setting.** Legal-take highlights can be turned off; refusals work either way.
- **E4. Sound.** Short effects synthesized with the Web Audio API, starting only after a user action, with a remembered mute setting. Sound is never the only signal of an event.
- **E5. Results.** Wins, losses and draws per difficulty against the bot, kept only in the browser, with a reset. Two-player games are not counted.
- **E6. Publishing.** A static site with relative asset paths that runs on any static host or as an itch.io HTML5 upload (`docs/publishing.md`). No service worker, accounts, network calls or analytics.

### 5.8 Two players

- **P1.** Two people take turns on one device. Player 1 is the engine's player A and Player 2 is player B. Each takes on their own turn by tap, click or keyboard; there is no hand-off screen, because the state is fully public (spec §2).
- **P2.** In a bot game the human is Player 1 and the bot plays Player 2's seat, avatar and token.
- **P3.** The score of a sitting counts each seat's wins and the draws, from the first game after New game. Play again keeps it. Leaving to the title screen or starting a New game ends the sitting. It reads, for example, "Player 1 2 – 1 Player 2 · 1 draw", or "You 1 – 2 Bot" in a bot game.
- **P4.** The end screen offers Play again and Title screen in both modes.

## 6. Technical constraints

- TypeScript, npm workspaces, Vite, React, Vitest and Playwright, with exact pinned versions. No server.
- `packages/game` (`@okiya/game`) is the pure rules engine: plain serializable state, the legal takes, the take with its refusals, the end checks, and the game log with its parser and replay.
- `packages/bot` chooses a take from the state and a difficulty.
- `apps/web` is the React client. It talks to the engine and the bot only through their public entry points.
- The pure packages never import DOM, rendering or network libraries, timers, wall-clock time or `Math.random`. All randomness comes from a seeded generator.
- `packages/rules` and `packages/content` hold the retired fighter game and are deleted once nothing imports them.

## 7. Quality and acceptance

- Every rule of spec §1–§4 has a unit test that names the spec section it proves, including the order of the end checks.
- Determinism: a game log replays to the same final state every run; a malformed or illegal log is refused with a structured reason, never an exception.
- The bot only ever returns legal takes; a test proves each difficulty takes an immediate win, and a reference solver in the tests proves Hard perfect after the opening. Hard never loses a game it can still save at its first take after the opening.
- Browser tests cover the title screen, the mode choice, a new game, the match screen with both seats, the opening take, a legal turn and a refused take, the highlight setting, How to Play, resuming a game with its score, a full game to the end screen against the bot, a full two-player game to the end screen, the score of a sitting across Play again, the starter alternating, sound, the dark theme, the phone layout and keyboard play.

## 8. Delivery plan

Features run with the workflow controller (see `CLAUDE.md` and `features/README.md`). A lane is verified alone, so lanes split only along APIs already on the base.

1. `skeleton`, `full-rules`, `playtest-ready`, `release-polish` and `tabletop-ui` built the fighter game of rules v0.2, its published shell and the tabletop interface.
2. Preparation, before `pure-okiya`: `@okiya/game` with the complete rules v1.0 and its tests, and a thin `chooseTake` in `@okiya/bot`, beside the old packages so the base keeps building.
3. **`pure-okiya`**, two lanes: `bot` (§5.4: Easy, Normal and perfect Hard behind `chooseTake`) and `web` (the client on `@okiya/game`: §5.1–§5.3, §5.5–§5.7, with the fighter game removed).
4. Cleanup after `pure-okiya` merges: delete `packages/rules`, `packages/content`, the old bot code and their tests, and prune the workspace and lockfile.
5. **`two-player-table`**, one `web` lane (v1.1): two players on one device (§5.8), the seats and avatars, the Match card, the score of a sitting, the clearer feedback of §5.3 and §5.6, and the How to Play pages. The engine and the bot are unchanged.

## 9. Risks and open questions

- Okiya is a solved-size game: a perfect Hard bot may feel unfair. Easy and Normal must stay beatable, and the default difficulty is Normal. Measured with the exact solver on 120 boards (2026-10-04): the starter can force a win on 68% of boards and a draw on the rest, but only about 1.5 of the 12 openings keep that win. In 60 games each, Normal won 5 against Hard and Easy won 3 against Normal.
- The rules are a published game's mechanics. The name, art and branding stay our own (§1).
- Hidden information no longer exists, so every bot decision can be checked against the public state.
- Two seats, the Match card and the board must share a 390 px phone screen without crowding the tap targets (U6).
