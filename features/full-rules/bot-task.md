# Task: bot

## Goal

Replace the random skeleton bot in `packages/bot` with the heuristic bot of `docs/prd.md` §5.4: it chooses its setup and every action from its own player view, takes an immediate win, avoids handing the human the win, disrupts visible threats and plays deterministically.

## Context

- Read `docs/prd.md` §5.4 and §5.1 (S2), `docs/paper-simulation.md` §7 (the move-priority guide), the findings F1 and F2 in `docs/paper-test-01.md`, and `docs/architecture.md`.
- The bot sees a `PlayerView` and the legal-action list. For lookahead it builds a hypothetical full state with `hypotheticalState(view)` and calls `listLegalActions`, `applyAction` and `objectiveResult` on it.
- The `rules` lane implements abilities, traps and locks in parallel, and you are verified without its changes: in your worktree only deploy and move have legal actions. Lookahead that goes through the public API covers ability actions automatically once the rules land.

## Constraints

- Change only `packages/bot/src` and `tests/unit/bot.test.ts`. Never change `packages/rules`, `packages/content`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Import only the public entry point of `@okiya/rules`. Never read the real match state, the human's traps, reserve identities or inspection results (PRD B1).
- Keep the exported signature `chooseSetup(input)`, and keep `chooseAction(view, legalActions)` callable with two arguments. `chooseAction` takes an optional third argument with a maximum search depth (default 2) and a time budget (default 800 ms); it searches depth by depth and returns the best action of the deepest completed level. `chooseSetup` draws only from `input.privateSeed`; `chooseAction` draws only from a generator seeded by the view's seed and turn (PRD B3).
- No `Math.random`, timers or wall-clock time inside the bot.

## Acceptance

All in `tests/unit/bot.test.ts`, on positions built with `prepareMatch`, `startMatch` (scenarios allowed) and deploy or move actions through `applyAction`:

- The bot only ever returns an action from the legal-action list.
- It takes an available immediate Square win.
- When the human threatens to complete a square next turn and a legal action blocks the hole, it blocks (paper test 01 F2).
- It prefers an action that leaves it at least one legal action next turn over one that blockades itself.
- Among equal choices it does not hand over a constraint that gives the human an immediate win, when another action exists.
- The same view and legal-action list give the same action, and the same setup input gives the same setup.
- `chooseSetup` returns a setup `validateSetup` accepts under `spec-v0.2` and under a preset with a displacer limit of 1.
- With a maximum depth of 1 the bot misses a threat that the human completes with the reply, and at the default depth of 2 it blocks it.
- `chooseAction` returns within one second on a midgame position with every fighter deployed (PRD B4), both at the defaults and with a maximum depth of 5, where the time budget cuts the search short.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A required behaviour needs a field or export that `@okiya/rules` does not offer.
- A test can pass only by changing a path outside the owned paths.
- After three hours of work, the `unit` check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
