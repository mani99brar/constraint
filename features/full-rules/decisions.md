# Decisions: full-rules

From the grill session of 2026-10-02 with the operator.

## Decisions

- The displacer limit is proven at unit level, not in the browser: `web` tests show the `displacer-limit` refusal from `validateSetup` with a hand-built preset whose limit is 1, and `rules` tests the limit inside `validateSetup`. Consequence: the `setup-flow` scenario covers only `spec-v0.2`, which has no limit, and its description in `policy.json` drops the displacer-limit clause.
- Every match starts on the setup screen; nothing skips it. The screen also offers a "Use default setup" button that fills in the paper test 01 roster of side A and the setup traps on distinct cells chosen from the match seed, then starts the match. Consequence: `start-match` and `legal-turn` start through that button; only `setup-flow` picks fighters and places traps by hand.
- The heuristic bot searches two plies by default: each of its legal actions on a hypothetical state, then the human's best reply. It ignores enemy traps it cannot see. As a tie-break, it avoids spending a charge to enter a cell no fighter has entered since setup. Consequence: every PRD B2 priority is provable with deploy and move positions, and the bot stays beatable (PRD §10).
- Search depth is configurable inside `bot` only. `chooseAction` takes an optional third argument with a maximum depth (default 2) and a time budget (default 800 ms), searches depth by depth, and returns the best action of the deepest completed level. Consequence: `apps/web` keeps the two-argument call, `bot` tests cover depth 1 and depth 2, and no setting can break PRD B4's one-second limit.
- The bot is a deterministic TypeScript module in the browser, never a model call. Consequence: replays reproduce its turns (PRD B3), and no server or API key is needed.

## Assumptions

- `rules` keeps every existing export of `packages/content/src` and may only add to it, because `web` imports `TILES`, `SPEC_V0_2` and `defaultSetup` and is verified without `rules`' changes.
- `web` shows projected events in spec §11 order without blocking animations. Browser tests never wait on an animation, and the bot's existing pause stays the only delay.
- No lane adds dependencies or changes any `package.json`, `package-lock.json` or root config, as each task says. A missing library is a `blocked` report, not a workaround.
- `rules` may add test-only helpers under `packages/rules/src/core` and fixtures under `packages/content/src`; `bot` and `web` build their test positions only through the public API of `@okiya/rules`.
- The workers run with a deadline of four hours (`--worker-timeout-seconds 14400`), so each lane's three-hour `## Stop` bound is reached before its deadline.

## Deferred

- A difficulty setting in the interface for the bot's search depth (`playtest-ready` or later).
- Choosing a preset in the interface, and with it a browser test of the displacer limit (`playtest-ready`).
- A model-backed opponent, which needs a server.
- Log export, loading and step-through, scenarios in the interface, the phone layout, keyboard navigation and a full-match browser test (`playtest-ready`).
