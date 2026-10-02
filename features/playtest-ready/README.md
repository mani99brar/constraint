# playtest-ready

The third feature of Okiya (`docs/prd.md` §9 step 3): match logs with export, load, step-through and continue; presets, seeds, scenarios and bot depth chosen at match start; the phone layout and keyboard play; and a browser test that plays a match to its end screen. It also closes the open review findings of `full-rules`.

- `engine` owns `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src` and `tests/unit/bot.test.ts`.
- `web` owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`.

The lanes meet only at interfaces already on `main` (commit `b3d30f7` added the log functions, the new preset and the swapped scenario). `packages/rules/src/api`, the `package.json` files, `package-lock.json` and root configs belong to no lane. A review sidecar (`builtin:senior-review`) reviews the lanes while they work.

- `feature.json`: the lanes, their task files, the reviewers, the sidecar and the `prd` the design challenge reads.
- `policy.json`: each lane's owned paths and the checks the controller runs independently.
- `engine-task.md`, `web-task.md`: the lanes' outcome briefs.
- `decisions.md`: the operator's decisions from `/workflow-grill playtest-ready`.

Launch: `workflow launch playtest-ready --dry-run`, then `--live --automatic` (see the operator notes in `CLAUDE.md`).
