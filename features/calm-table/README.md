# calm-table

The feature after `game-feel` (`docs/prd.md` v1.3, §8 step 7). It follows the operator's feedback on the deployed build:
- tiles are spaced on a calm paper or slate ground;
- legal tiles are shown by brightness and a light wash of the mover's colour;
- the tile flight is gone;
- the end of a game plays briefly on the board;
- the home screen has one play panel;
- the game screen shows each piece of information once, with tile names on demand.

The rules (`docs/game-spec.md` v1.0) and the bot do not change. The decisions come from the grill session of 2026-10-04 (`decisions.md`).

- `feature.json`: one lane, `web`, the two reviewers and the senior-review sidecar; its `prd` is `docs/prd.md`.
- `policy.json`: the `web` lane owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`, with typecheck, unit, build and 24 browser scenarios.
- `web-task.md`: the lane's task.
- `decisions.md`: the operator's decisions, assumptions and deferrals.

Launch: `workflow launch calm-table --dry-run`, then `--live --automatic` (see `CLAUDE.md`).
