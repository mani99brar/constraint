# Okiya features

Each directory with a `feature.json` is a workflow feature (see the operator notes in `CLAUDE.md`).

## Order

1. `skeleton`, one lane. It puts the repository layout, the toolchain and the shared APIs on `main`: the rules engine's state, legal-action listing, action application and per-player view in `packages/rules`, and typed content in `packages/content`.
2. Features from `docs/prd.md`, each with parallel lanes that own disjoint paths and meet only at APIs already on `main`.

## Planned lane split (`docs/prd.md` §9)

| Feature | Lane | Owns | Builds against |
| --- | --- | --- | --- |
| `full-rules` | `rules` | `packages/rules/src/core`, `packages/rules/src/abilities` | `packages/rules/src/api`; the 45 edge cases and the 28-action replay from `docs/paper-test-01.md`, and the preset variant switches |
| `full-rules` | `bot` | `packages/bot` | the player view, the hypothetical state and the legal-action list |
| `full-rules` | `web` | `apps/web`, `tests/e2e` | the player view, the event projection and the legal-action list, so new abilities appear without UI changes |
| `playtest-ready` | `engine` | `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src`, `tests/unit/bot.test.ts` | two playtest presets, replay determinism and the bot's open review findings |
| `playtest-ready` | `ux` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | visual design, turn clarity, action feedback and onboarding; presets, scenarios and bot depth at start; phone and keyboard; a full-match browser test |
| `release-polish` | `engine` | `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src`, `tests/unit/bot.test.ts` | safe replay of stored logs, reliable bot timing proof |
| `release-polish` | `web` | `apps/web/src`, `apps/web/index.html`, `apps/web/vite.config.ts`, `tests/e2e`, `docs/publishing.md` | the published game Constraint (PRD §5.8) |
| `tabletop-ui` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | the tabletop interface (PRD §5.9) |
| `pure-okiya` | `bot` | `packages/bot/src` | `@okiya/game` (rules v1.0); Easy, Normal and perfect Hard behind `chooseTake` |
| `pure-okiya` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | the client on `@okiya/game` and `chooseTake`, with the fighter game removed |
| `two-player-table` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | PRD v1.1: two players on one device, seats and avatars, the Match card and the score of a sitting, on the unchanged `@okiya/game` and `chooseTake` |
| `game-feel` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | PRD v1.2: one home screen, the tabletop-materials finish, avatar reactions, toasts and phone seats that leave the board clear |
| `calm-table` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | PRD v1.3: spaced tiles on a calm ground, legal tiles by brightness and wash, no tile flight, a brief end sequence, a one-panel home, each piece of information once |
| `final-polish` | `web` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | PRD v1.4: pop-and-glow move highlights with measured visibility, three colour themes with a menu switch, a scoreboard row, the phone fit |

Core and abilities share one lane because trap, lock and ability resolution are entangled (skeleton design challenge, attempt 1). `packages/rules/src/api` and `package-lock.json` belong to no parallel lane: change them in a small feature on `main` first.

When a lane needs a new shared type or function, add it to `main` in a small feature first, then fan out. Do not give two lanes the same owned path.

A layout rule that differs by screen size (wide and phone) needs an acceptance item and a browser scenario for each size: `two-player-table-001`'s coverage review blocked on wide-screen seat placement that only the phone scenario tested.

## New feature

```bash
workflow init <feature>          # scaffold features/<feature>/ with TODO: placeholders
# add a workers entry to feature.json and policy.json, and a <lane>-task.md, per extra lane
/workflow-grill <feature>        # in Claude Code: writes decisions.md
workflow launch <feature> --dry-run
```

## Operator notes

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
