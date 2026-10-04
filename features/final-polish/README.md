# final-polish

The last feature after `calm-table` (`docs/prd.md` v1.4, §8 step 8). It follows the operator's feedback on the deployed build:
- the playable tiles pop and glow in the mover's colour, with measured visibility;
- three coherent colour themes (Walnut and parchment by default, Sea glass and stone, Clear) with a Theme switch in the menu;
- a scoreboard row puts the score beside the Match card;
- the phone layout has no empty band.

The rules (`docs/game-spec.md` v1.0) and the bot do not change. The decisions come from the grill session of 2026-10-04 (`decisions.md`).

- `feature.json`: one lane, `web`, the two reviewers and the senior-review sidecar; its `prd` is `docs/prd.md`.
- `policy.json`: the `web` lane owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`, with typecheck, unit, build and 27 browser scenarios.
- `web-task.md`: the lane's task.
- `decisions.md`: the operator's decisions, assumptions and deferrals.

Launch: `workflow launch final-polish --dry-run`, then `--live --automatic` (see `CLAUDE.md`).
