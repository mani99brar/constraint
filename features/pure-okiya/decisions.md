# Decisions: pure-okiya

From the requirements session of 2026-10-02 with the operator.

## Decisions

- Constraint plays Okiya's rules, not a variant of them: `docs/game-spec.md` v1.0 replaces the fighter game of v0.2 (fighters, abilities, traps, recharge, rosters, hidden objectives). Consequence: the interface has no setup screen, trays, fighter actions or hidden information. The name stays Constraint, with its own tile theme and art.
- A full board with no shape is a draw (spec §4). Consequence: the end screen and the results have a draw.
- A match is one game; the first starter is random and Play again alternates it (spec §5). Consequence: no rounds or score display, and the results by difficulty stay as they are.
- The bot keeps Easy, Normal and Hard. Easy looks one take ahead, Normal three, and Hard plays perfectly from the second take of a game on, with a position budget at the opening only. Consequence: Hard is unbeatable whenever it can force a win or a draw, and Easy and Normal can be beaten.
- The engine `@okiya/game` (`packages/game`) and the thin `chooseTake` in `packages/bot/src/take.ts` were put on the base before this run, beside the old packages, so `main` keeps building. Consequence: two parallel lanes. `bot` owns `packages/bot/src` and `web` owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`; no lane owns `packages/game`.
- The old engine and content packages (`packages/rules`, `packages/content`) and the old bot exports are deleted after this feature merges, outside the run. Consequence: `bot` keeps the old exports and `tests/unit/bot.test.ts` passing, and `web` stops importing the old packages.

## Assumptions

- The web lane's browser tests never depend on which tile the bot takes, because the merged candidate runs them against the real bot.
- The saved game is the game log (`gameLogOf`) plus the difficulty. A save from the fighter game fails `parseGameLog` and is discarded.
- The results by difficulty are kept across the change; old counts stay.
- No lane adds dependencies or changes any `package.json`, `package-lock.json`, root config, `packages/game` or the old packages.
- The workers run with a four-hour deadline (`--worker-timeout-seconds 14400`), so each lane's three-hour `## Stop` bound comes first.

## Deferred

- Deleting `packages/rules`, `packages/content`, the old bot code and their tests, and pruning the workspace and lockfile (a cleanup commit after this feature merges).
- Rounds or a match score, local two-player hotseat, online play.
- Okiya's optional variants and any rule beyond spec v1.0.
