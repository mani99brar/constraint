# full-rules

The second feature of Okiya: the complete rules, the heuristic bot and the playable interface, in three parallel lanes. Its specification is `docs/prd.md` (§9 step 2); the rules are `docs/game-spec.md` v0.2, and the evidence is `docs/paper-test-01.md`.

- `rules` owns `packages/rules/src/core`, `packages/rules/src/abilities` and `packages/content/src`.
- `bot` owns `packages/bot/src` and `tests/unit/bot.test.ts`.
- `web` owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`.

The lanes meet only at `packages/rules/src/api`, which none of them owns. `package-lock.json`, the `package.json` files and root configs belong to no lane either.

- `feature.json`: the lanes, their task files, the reviewers and the `prd` the design challenge reads.
- `policy.json`: each lane's owned paths and the checks the controller runs independently.
- `rules-task.md`, `bot-task.md`, `web-task.md`: the lanes' outcome briefs.
- `decisions.md`: the operator's decisions from `/workflow-grill full-rules`.

Launch: `workflow launch full-rules --dry-run`, then `--live --automatic` (see the operator notes in `CLAUDE.md`).
