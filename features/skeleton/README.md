# skeleton

The first feature of Okiya. It turns the repository into a walking skeleton: the monorepo layout and toolchain, the pure rules-engine API in `packages/rules`, typed content in `packages/content`, and one thin playable path in `apps/web`. Its specification is `docs/prd.md`, written after the paper simulation in `docs/paper-simulation.md`; the rules come from `docs/game-spec.md`.

It runs as one lane on purpose. Later features split into parallel lanes along the APIs this one puts on `main` (see `features/README.md`).

- `feature.json`: the lane, its task file, the reviewers (`builtin:<id>` names a bundled brief), the `prd` the design challenge reads and `challenge` (default true).
- `policy.json`: the lane's owned paths and the checks the controller runs independently.
- `main-task.md`: the lane's task as an outcome brief (## Goal, ## Acceptance and ## Stop are required).
- `decisions.md`: the operator's decisions, assumptions and deferrals from the workflow-grill interview.

Launch: `workflow launch skeleton --dry-run`, then `--live --automatic` (see the operator notes in `CLAUDE.md`).
