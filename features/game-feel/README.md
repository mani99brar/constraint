# game-feel

The feature after `two-player-table` (`docs/prd.md` v1.2, §8 step 6). Constraint feels like a physical game on the same theme:
- one home screen replaces the title, mode and difficulty screens;
- a tabletop-materials finish: light, shadows, wood, felt and bevelled pieces;
- the two avatars react to what just happened;
- toasts and phone seats no longer cover or crowd the board.

The rules (`docs/game-spec.md` v1.0) and the bot do not change. The decisions come from the grill session of 2026-10-04 (`decisions.md`).

- `feature.json`: one lane, `web`, the two reviewers and the senior-review sidecar; its `prd` is `docs/prd.md`.
- `policy.json`: the `web` lane owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`, with typecheck, unit, build and 21 browser scenarios.
- `web-task.md`: the lane's task.
- `decisions.md`: the operator's decisions, assumptions and deferrals.

Launch: `workflow launch game-feel --dry-run`, then `--live --automatic` (see `CLAUDE.md`).
