# Task: engine

## Goal

Make match logs safe to load from untrusted files, and close the bot's open review findings now that the full rules exist: no input to `parseMatchLog` and `replayMatchSteps` may throw, and the bot's search budget, tie-break and timing are proven on positions with abilities and traps.

## Context

- Read `docs/prd.md` §5.4–§5.6 and §8, `docs/architecture.md`, and `packages/rules/src/core/log.ts`. Commit `b3d30f7` on `main` added `parseMatchLog`, `replayMatchSteps` and the `unknown-action` refusal. `parseMatchLog` checks the log's shape but not the preset values, setups or scenario contents, so a malformed preset can still make the replay throw.
- The full-rules reviewers left these open:
  - the one-second test does not prove that the position budget, rather than a finished shallow search, keeps depth 5 fast;
  - the "avoid unscouted cells" tie-break (`UNSCOUTED_ENTRY = 0.1` in `packages/bot/src/search.ts`) outweighs real score differences such as two actions of mobility, so it is not a tie-break, and no test exercises it;
  - the default budget and the timing were measured before abilities existed, and paper test 01 F1 (entering a hole by pull or swap) has no dedicated test.
- The `web` lane runs in parallel and is verified without your changes. It imports from `@okiya/content` `TILES`, `PRESETS`, `SCENARIOS`, `SPEC_V0_2`, `SPEC_V0_2_TWO_DISPLACERS`, `PAPER_TEST_01`, `PAPER_TEST_01_SWAPPED` and `defaultSetup`, from `@okiya/bot` `chooseSetup`, `chooseAction`, `DEFAULT_MAX_DEPTH` and `SearchOptions`, and the public API of `@okiya/rules`.

## Constraints

- Change only `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src` and `tests/unit/bot.test.ts`. Never change `packages/rules/src/api`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Keep every existing export and signature named above; you may add exports. `SearchOptions` may gain optional fields.
- `packages/rules` never imports `packages/content`, so preset validation needed by `parseMatchLog` lives in `packages/rules/src/core`. Keep it consistent with `validatePreset` in `packages/content/src`, for example by having the content validator reuse it through the public API.
- Keep the number and order of random draws in `prepareMatch` and `startMatch` unchanged.
- Purity rules stay: no DOM, timers, wall-clock time or `Math.random` in `packages/rules`, `packages/content` or `packages/bot` (`tests/unit/purity.test.ts`).

## Acceptance

- `parseMatchLog` refuses, with `not-a-match-log` and the offending field path, a log whose preset values, setups or scenario are malformed: a missing or mistyped preset key, an out-of-range number, an unknown fighter type, an off-board cell, a malformed scenario board. A unit test covers each.
- A unit test mutates an exported log field by field (removing each field, replacing it with each JSON type) and proves that `parseMatchLog` followed by `replayMatchSteps` never throws and always returns a structured result.
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
