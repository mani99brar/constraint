# Decisions: tabletop-ui

From the requirements interview of 2026-10-02 with the operator.

## Decisions

- The match screen is the board and nothing else in the way: the log, last actions, status, reserve list, "on the board" list, legend and settings panel are removed. Consequence: the information they carried moves to the top bar, the tokens, the cells, the trays, toasts and the menu, as `web-task.md` lists; `match-screen` proves none of the panels remain.
- Unplaced fighters live in a piece tray: the player's tokens under the board, the bot's face-down above it, each hiding once empty. Consequence: deployment (a core rule) stays visible without a list; `piece-tray` proves it.
- Actions live on the piece: tapping a token makes its move cells glow and shows its ability and recharge buttons beside it. Consequence: no action bar or side panel; `piece-actions` proves it.
- A minimal top bar (turn, constraint emblems, recharge pips, goal chip, menu) plus short event toasts replace every text panel, and no move history is kept on screen. Consequence: PRD I2's persistent log is dropped; events are shown at the time they happen (§5.9).
- The look is a tabletop: a framed tray of illustrated square tiles with a large terrain scene and a symbol emblem, round tokens with distinct emblems, a soft garden palette, all original art drawn in code. Consequence: no image, font or audio files, and nothing imitating the published Okiya game's art or branding.

## Assumptions

- Settings (highlights, sound) move into the menu dialog, which also offers How to Play and quit to title; quitting keeps the saved match.
- The turn number, the "N legal actions" sentence and the bot difficulty label leave the match screen; glowing tokens and cells show what the player can do.
- The setup screen follows the same look: fighters picked as tokens and traps placed by tapping board cells.
- The browser scenarios of release-polish are rewritten for the new layout; ids that remain keep their meaning.
- The review sidecar reviews every five minutes, and the worker runs with a four-hour deadline (`--worker-timeout-seconds 14400`).

## Deferred

- Artist-made images, recorded audio and animation beyond short transitions.
- A move-history view.
- Everything deferred by earlier features: log export and replay, the bot's public options, a Line objective and the rule experiments in `~/dev/okiya-playtests`.
