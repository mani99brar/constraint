# Okiya

Constraint: Okiya's rules (take a tile matching the last one, place a token, win by a line, a square or a blockade) on a 4×4 board of terrain/symbol tiles, played in the browser against a bot or by two players on one device. The rules are `docs/game-spec.md` v1.0 and the product requirements are `docs/prd.md` v1.3; section numbers (§) below refer to the spec. `docs/paper-simulation.md` and `docs/paper-test-01.md` document the retired fighter game (spec v0.2) and are history only.

- Stack: TypeScript everywhere, npm workspaces. The pure rules engine of rules v1.0 (`packages/game`, `@okiya/game`) is shared by a bot (`packages/bot`) and the React browser client (`apps/web`). There is no server. `packages/rules` and `packages/content` hold the old fighter game (spec v0.2) and are deleted once nothing imports them.
- Build and test commands: install `npm ci`; dev server `npm run dev` (port 5493); `npm run typecheck`; unit tests `npm run test:unit`; browser tests `npx --no-install playwright test --config=tests/e2e/playwright.config.ts`; build `npm run build`.
- Authoritative logic (`packages/game`, `packages/rules`, `packages/content`) never imports DOM, rendering or network libraries, timers, wall-clock time or `Math.random`. Randomness comes from a seeded generator kept in the state.
- The state is fully public (spec §2), and every game replays from its seed, starter and takes (spec §6).
- Boundaries: never change `docs/game-spec.md`, `docs/paper-simulation.md`, `docs/paper-test-01.md`, `docs/prd.md` or anything under `features/`.
- This machine is shared by parallel runs: never stop processes by name pattern (`pkill -f`, `killall`); stop only the PIDs you started.

## Workflow (operator notes; workers skip this section)

Features under `features/` run with md-manager's workflow controller (`~/dev/md-manager/workflow`, documented in its README.md and RUNBOOK.md). The `workflow` command on PATH wraps `~/dev/md-manager/.venv/bin/python -m workflow`. With no `--repo` flag, it targets this repository.

- Order: `skeleton` first, alone. Parallel features and lanes come after it, along the APIs it puts on `main` (see `features/README.md`).
- Interview: `/workflow-grill <feature>` writes `features/<feature>/decisions.md`. Commit the feature files before launching; preparation refuses a dirty tree.
- Tasks: every acceptance item names the test that proves it. Items without one are what coverage reviewers block on.
- Check: `workflow launch <feature> --dry-run`.
- Launch in a new Herdr tab: `WORKFLOW_WORKER_EFFORT=medium ANTHROPIC_MODEL=claude-opus-5-5 workflow launch <feature> --live --automatic --worker-timeout-seconds 10800 --review-timeout-seconds 3600`. The design challenge is a headless print job that prints nothing until its verdict, so never interrupt it.
- Runs are stored in `~/.local/state/agent-workflows/okiya/<feature>/<run-id>`. `workflow status|answer|resume|repair` take that run path.
- Workers run targeted tests only; the controller's verifier runs the full policy checks.
- The web client's fixed port is 5493, chosen not to collide with project-B's 2593 and 5393. Stop any `npm run dev` before launching a feature with browser checks.
- This VPS (4 cores, 7.9 GB) fits 3–4 worker lanes in total across all running features, including project-B's.
- Two features at once: launch each from its own checkout (`git worktree add ~/dev/okiya-<name> -b <name>/base main`, then `--repo ~/dev/okiya-<name>`). Parallel features must own disjoint paths.
- A lane is verified alone first, so it cannot compile against another lane's new types: split lanes only along an API that is already on `main`.
