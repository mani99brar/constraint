# Task: web

## Goal

Move the client in `apps/web` to the rules v1.0 of Constraint: Okiya's rules, played against the bot on the tabletop interface. The player takes a tile that matches the last tile and a token appears on its cell. The first take is any edge tile. Four in a row (row, column or long diagonal), a 2×2 square, or a blockade of the opponent wins; a full board draws. Every trace of the old fighter game goes: fighters, abilities, traps, recharge, rosters, the setup screen, the piece trays and the objectives.

## Context

- Read `docs/game-spec.md` (rules v1.0), `docs/prd.md` (v1.0, §5, which governs the interface), `features/pure-okiya/decisions.md`, and the current client in `apps/web/src` with its browser tests in `tests/e2e/`. The current client is the tabletop interface of the `tabletop-ui` feature: a board-only match screen, a slim top bar, toasts, a menu dialog, illustrated tiles, How to Play, saved games, results by difficulty, synthesized sound and both themes. Keep its look and these parts; replace what is specific to the fighter game.
- The rules engine is `@okiya/game` (`packages/game/src`): `newGame`, `legalTakes`, `validateTake`, `take`, `tileAt`, `tokenAt`, `LINES`, `SQUARES`, `EDGE_CELLS`, and `gameLogOf`, `parseGameLog` and `replayGame` for saving and restoring a game. The state is fully public.
- The bot is `chooseTake(state, { difficulty })` from `@okiya/bot`, with `difficulty` `'easy'`, `'normal'` or `'hard'`. The `bot` lane replaces its thin first version in parallel. You are verified against the thin version, and the merged candidate runs your browser tests against the real bot.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies, and no image, font or audio files. All art stays inline SVG or CSS, original, and never imitates the published Okiya game's artwork or branding, and the game's name stays Constraint.
- `apps/web/src` imports neither `@okiya/rules` nor `@okiya/content`; those old packages are deleted after this feature merges.
- Where information goes:
  - **Board:** each tile shows its terrain scene and symbol emblem. A taken cell shows the taker's token instead of its tile. The last take is marked until the next one. When the game ends, the winning shape's four cells are marked.
  - **Top bar:** whose turn ("Your turn" or "Bot is thinking"), the last tile as two emblems with their names ("Any edge tile" at the opening), each player's remaining token count out of 8, and a menu button.
  - **Toasts:** a refused take with its reason, naming the tile and the last tile ("Desert–Moon matches neither Forest nor Star"), and the end of the game.
  - **Menu dialog:** resume, How to Play, the highlight and sound settings, and quit to title (the saved game is kept).
- Taking a tile: tap or click a tile, or move the keyboard focus to it and press Enter. With highlights on, the legal tiles glow; with them off, nothing glows and the takes and refusals work the same. The end screen names the result and how it happened (line, square, blockade or a full-board draw), counts it in the results for that difficulty, and offers Play again. Play again starts a new game with the other player starting. The very first game's starter is random.
- The New game flow is title, then difficulty (Easy, Normal or Hard), then the board. Save the unfinished game as its game log and difficulty after every take. Restore it with `parseGameLog` and `replayGame`, and discard it safely when either refuses. Keep the results by difficulty, the highlight and sound settings, the reduced-motion handling, both themes, the StrictMode-safe bot scheduling with its short pause, and port 5493.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin.
- Browser tests fix the page's randomness through `addInitScript`, read tiles and tokens from the page, never wait on an animation, and never depend on which tile the bot takes: the merged candidate runs them against the real bot.

## Acceptance

- Unit (`npm run test:unit`):
  - no module under `apps/web/src` imports `@okiya/rules` or `@okiya/content`, and no fighter, trap, recharge, roster or objective text remains in the interface strings;
  - the board model gives every cell its tile or token, the glowing cells are exactly `legalTakes`, the last-take mark follows the latest take, and the winning shape's cells are marked at the end;
  - the top bar model gives the turn text, the last tile's two emblems ("Any edge tile" at the opening) and both remaining token counts for hand-built states;
  - every refusal code of `@okiya/game` has readable text naming the tiles involved;
  - the end-screen text covers a win by line, square and blockade, a loss of each kind and the full-board draw;
  - a saved game round-trips through the save module, and a malformed or illegal save is discarded without throwing;
  - the starter of the next game is the other player.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them: `title-screen`, `new-game`, `match-screen`, `opening-take`, `legal-turn`, `highlight-toggle`, `how-to-play`, `resume-match`, `full-match`, `starter-alternates`, `sound-toggle`, `dark-theme`, `phone-layout` and `keyboard-play`. `phone-layout` runs at a 390 px viewport, `dark-theme` emulates the dark colour scheme, and `full-match` fails after 20 takes.

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
