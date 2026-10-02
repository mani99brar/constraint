# release-polish

The fourth feature: turns the playable game into the published static web game **Constraint** (`docs/prd.md` §5.8 and §9 step 4). It removes the playtest helpers, adds a title screen, a How to Play dialog, a highlight toggle, synthesized sound, match resume and local results, prepares a host-agnostic static build, and fixes the open review findings of playtest-ready.

- `engine` owns `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src` and `tests/unit/bot.test.ts`: safe replay of stored logs and a reliable bot timing proof.
- `web` owns `apps/web/src`, `apps/web/index.html`, `apps/web/vite.config.ts`, `tests/e2e` and `docs/publishing.md`: everything players see.

A review sidecar reviews both lanes every five minutes.

Launch: `workflow launch release-polish --dry-run`, then `--live --automatic` (see the operator notes in `CLAUDE.md`).
