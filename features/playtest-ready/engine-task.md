# Task: engine

## Goal

Add the two playtest presets, prove that match logs replay exactly now that abilities and traps exist, and close the bot's open review findings: its search budget, tie-break and timing are proven on positions with abilities and traps.

## Context

- Read `docs/prd.md` §5.4–§5.6 and §8, `docs/architecture.md`, and `packages/rules/src/core/log.ts`. Loading logs in the interface is out of scope for this feature (see `decisions.md`), so hardening `parseMatchLog` against untrusted files is deferred.
- The full-rules reviewers left these open:
  - the one-second test does not prove that the position budget, rather than a finished shallow search, keeps depth 5 fast;
  - the "avoid unscouted cells" tie-break (`UNSCOUTED_ENTRY = 0.1` in `packages/bot/src/search.ts`) outweighs real score differences such as two actions of mobility, so it is not a tie-break, and no test exercises it;
  - the default budget and the timing were measured before abilities existed, and paper test 01 F1 (entering a hole by pull or swap) has no dedicated test.
- The `ux` lane runs in parallel and is verified without your changes. It imports from `@okiya/content` `TILES`, `PRESETS`, `SCENARIOS`, `SPEC_V0_2`, `SPEC_V0_2_TWO_DISPLACERS`, `PAPER_TEST_01`, `PAPER_TEST_01_SWAPPED` and `defaultSetup`, from `@okiya/bot` `chooseSetup`, `chooseAction`, `DEFAULT_MAX_DEPTH` and `SearchOptions`, and the public API of `@okiya/rules`.

## Constraints

- Change only `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src` and `tests/unit/bot.test.ts`. Never change `packages/rules/src/api`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Keep every existing export and signature named above; you may add exports. `SearchOptions` may gain optional fields.
- `packages/rules` never imports `packages/content`.
- Keep the number and order of random draws in `prepareMatch` and `startMatch` unchanged.
- Purity rules stay: no DOM, timers, wall-clock time or `Math.random` in `packages/rules`, `packages/content` or `packages/bot` (`tests/unit/purity.test.ts`).

## Acceptance

- `PRESETS` includes `spec-v0.2-locked-dont-count` (`lockedFightersCountTowardObjective` false) and `spec-v0.2-repetition-2` (`repetitionThreshold` 2), each valid under `validatePreset`.
- Under `spec-v0.2-locked-dont-count`, a unit test shows that a lock expiring never wins on its own, and that the square counts at the next objective check after any player's action.
- A unit test exports the log of a seeded bot-against-bot match that uses abilities and triggers traps, reloads it through JSON, and replays it to an identical final state with `replayMatchSteps`.
- Bot, in `tests/unit/bot.test.ts`:
  - an observable search result (for example an optional statistics callback in `SearchOptions`) proves that at depth 5 the position budget, not search completion, stopped the search, and that depth 2 completes within the default budget on a midgame position with abilities;
  - the unscouted-cell penalty decides only between actions whose other scores are equal, and a test shows it choosing between two such actions and not overriding a better-scoring one;
  - when the human threatens to fill a hole by pulling or swapping (paper test 01 F1), the human has no immediate win after the bot's action, asserted as an outcome;
  - `chooseAction` returns within one second at the defaults and at depth 5 on a midgame position with every fighter deployed and charged.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A test can pass only by changing `packages/rules/src/api` or a path outside the owned paths.
- After three hours of work, the `unit` check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
