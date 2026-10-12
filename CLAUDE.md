# Okiya

Constraint: Okiya's rules (take a tile matching the last one, place a token, win by a line, a square or a blockade) on a 4×4 board of terrain/symbol tiles, played in the browser against a bot or by two players on one device. The rules are `docs/game-spec.md` v1.0 and the product requirements are `docs/prd.md` v1.4; section numbers (§) below refer to the spec. `docs/paper-simulation.md` and `docs/paper-test-01.md` document the retired fighter game (spec v0.2) and are history only.

- Stack: TypeScript everywhere, npm workspaces. The pure rules engine of rules v1.0 (`packages/game`, `@okiya/game`) is shared by a bot (`packages/bot`) and the React browser client (`apps/web`). There is no server. `packages/rules` and `packages/content` hold the old fighter game (spec v0.2) and are deleted once nothing imports them.
- Build and test commands: install `npm ci`; dev server `npm run dev` (port 5493); `npm run typecheck`; unit tests `npm run test:unit`; browser tests `npx --no-install playwright test --config=tests/e2e/playwright.config.ts`; build `npm run build`.
- Authoritative logic (`packages/game`, `packages/rules`, `packages/content`) never imports DOM, rendering or network libraries, timers, wall-clock time or `Math.random`. Randomness comes from a seeded generator kept in the state.
- The state is fully public (spec §2), and every game replays from its seed, starter and takes (spec §6).
- Boundaries: never change `docs/game-spec.md`, `docs/paper-simulation.md`, `docs/paper-test-01.md`, `docs/prd.md` or anything under `features/`.
- This machine is shared by parallel runs: never stop processes by name pattern (`pkill -f`, `killall`); stop only the PIDs you started.

## Workflow
Operator notes for launching features (workers skip): `features/README.md`, section "Operator notes".
