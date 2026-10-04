# two-player-table

The feature after `pure-okiya` (`docs/prd.md` v1.1, §8 step 5). Constraint becomes a table for one or two people at one screen:
- a mode choice (Versus bot or Two players on one device);
- a seat beside the board for each player, with a fixed avatar drawn in code, a clear whose-move signal and the score of the sitting;
- a Match card showing the tile to match;
- clearer feedback;
- How to Play as short illustrated pages.

The rules (`docs/game-spec.md` v1.0) and the bot do not change. The decisions come from the grill session of 2026-10-04 (`decisions.md`).

- `feature.json`: one lane, `web`, the two reviewers and the senior-review sidecar; its `prd` is `docs/prd.md`.
- `policy.json`: the `web` lane owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`, with typecheck, unit, build and 18 browser scenarios.
- `web-task.md`: the lane's task.
- `decisions.md`: the operator's decisions, assumptions and deferrals.

Launch: `workflow launch two-player-table --dry-run`, then `--live --automatic` (see `CLAUDE.md`).
