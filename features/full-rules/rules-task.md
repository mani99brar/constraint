# Task: rules

## Goal

Make `packages/rules` implement the complete rules of `docs/game-spec.md` v0.2 §6–§12 behind the existing `src/api/`: recharge, all eight fighters, traps, locks, protection, repetition draws and the terminal ordering. Prove it with the 45 edge cases and the full match of paper test 01, and implement the preset variant switches.

## Context

- Read `docs/game-spec.md` §6–§12 (the authority), `docs/prd.md` §5.2, §5.5, §6 and §8, then `docs/architecture.md`. `docs/paper-test-01.md` holds the 28-action match ledger (Phase A, with legal-action counts per turn) and the walkthroughs of all 45 edge cases (Phase B) under spec v0.2.
- The skeleton already validates recharge and applies every effect kind, but the ability modules in `packages/rules/src/abilities/` offer no targets, traps never trigger, and the repetition draw is not enforced.
- Two other lanes run in parallel and are verified without your changes: `bot` builds against `listLegalActions`, `hypotheticalState` and `applyAction`, and `web` against `playerView`, `projectEvents` and the legal-action list. Your behaviour reaches them through those unchanged signatures.
- The skeleton review left these to this lane: when both setup calls get a scenario, `startMatch` drops the board override (`core/setup.ts`); `hypotheticalState` can mint a trap id that already exists (`core/hypothetical.ts`, `core/apply.ts`); `validateAction` has no default case for an unknown action kind; the view tests would not catch a leak of `trapHistory` or of the opponent's objective; and the paper test 01 board is only checked against itself.

## Constraints

- Change only `packages/rules/src/core`, `packages/rules/src/abilities` and `packages/content/src`. Never change `packages/rules/src/api`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Ability modules return effects through `targets` and `resolve`; core applies them and resolves traps, locks, protection, constraints and the win check (spec §11 order). Reshape the internals of core and abilities freely; keep every public signature.
- `packages/rules` never imports `packages/content`. Tests that need content data, such as the paper test 01 replay, live in `packages/content/src`.
- Every provisional value and variant switch comes from the preset, never a constant (`docs/prd.md` §6).
- Keep the number and order of random draws in `prepareMatch` and `startMatch` unchanged, so a given seed keeps its board and starting player for the web lane's browser tests.
- Purity rules stay as they are: no DOM, timers, wall-clock time or `Math.random`.

## Acceptance

- Every rule of spec §6–§12 has a unit test naming the spec section it proves.
- All 45 cases of `docs/paper-simulation.md` §8 are unit tests, each built from its `docs/paper-test-01.md` Phase B state with the outcome stated there. Each test title starts with `case <n>:`.
- The paper test 01 match replays in `packages/content/src`: its fixture and 28 recorded actions end with B winning by Square on action 28, and the legal-action count before each action equals the report's list. Where the spec shows the hand-kept report is wrong, the test records the corrected value with the spec section and the turn, and the engine is never bent to match.
- A unit test pins the paper test 01 scenario data cell by cell to the fixture table in `docs/paper-test-01.md`.
- Each variant switch of `docs/prd.md` §6 has a unit test showing the behaviour it changes: Puller on allies, locked fighters counting toward the objective, Anchor duration, and the displacer limit in `validateSetup`.
- Trap Checker follows spec v0.2 §9: one chosen adjacent cell, empty or enemy-occupied; its result appears only in its owner's view.
- The repetition draw fires on the third occurrence of a start-of-turn signature (case 44), and the terminal precedence is objective, then blockade, then repetition (cases 41 and 42).
- The deferred review findings are fixed, each with a test: scenarios from both setup calls merge; no lookahead trap id repeats; an unknown action kind returns a structured refusal; a view never contains the opponent's live trap cells or `trapHistory` during play, nor the opponent's objective when the two objectives differ.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A test can pass only by changing `packages/rules/src/api` or a path outside the owned paths.
- The spec v0.2 and a Phase B walkthrough disagree, and the spec does not settle which is right.
- After three hours of work, the `unit` check still fails and you cannot name the next fix.

Report `question` only for a rule the spec leaves open that changes an edge case's outcome.
