# Task: engine

## Goal

Make saved and loaded match logs safe to replay whatever they contain, because the published game now restores an unfinished match from browser storage, and make the bot's timing proof reliable under load.

## Context

- Read `docs/prd.md` (§5.6 and §10, release polish), `docs/architecture.md` and `packages/rules/src/core/log.ts`. `parseMatchLog` checks a log's shape but not the preset values, setups or scenario contents, so a malformed preset can still make `replayMatchSteps` throw.
- The `web` lane saves the current match with `matchLogOf` and restores it with `parseMatchLog` and `replayMatchSteps`. It runs in parallel, is verified without your changes, and discards a saved match on any failure; your work makes that failure a structured refusal instead of an exception.
- Review finding from playtest-ready: the bot's one-second test measures wall-clock time under Vitest's parallel workers, so a loaded machine can fail it although the position budget is what bounds the search.

## Constraints

- Change only `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src` and `tests/unit/bot.test.ts`. Never change `packages/rules/src/api`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies.
- Keep every existing export and signature. Do not change which action the bot chooses or which setup it picks for any input: the `web` lane's browser tests fix the page's randomness and rely on the bot's current choices.
- `packages/rules` never imports `packages/content`, so preset validation used by `parseMatchLog` lives in `packages/rules/src/core`; keep `validatePreset` in `packages/content/src` consistent with it, for example by reusing it.
- Keep the number and order of random draws in `prepareMatch` and `startMatch` unchanged. Purity rules stay (`tests/unit/purity.test.ts`).

## Acceptance

- `parseMatchLog` refuses, with `not-a-match-log` and the offending field path, a log whose preset values, setups or scenario are malformed: a missing or mistyped preset key, an out-of-range number, an unknown fighter type, an off-board cell, a malformed scenario board. A unit test covers each.
- A unit test mutates an exported log field by field (removing each field, and replacing it with each JSON type) and proves that `parseMatchLog` followed by `replayMatchSteps` never throws and always returns a structured result.
- A unit test round-trips the log of a seeded bot-against-bot match that uses abilities and triggers traps through `JSON.stringify` and `JSON.parse`, and replays it to an identical final state.
- The bot's speed requirement (PRD B4) is proven without a flaky wall-clock assertion: a test shows that every search at the defaults and at depth 5 stops within the position budget, and the wall-clock check, if kept, allows enough margin that parallel test load cannot fail it.
- Every existing bot test still passes unchanged in what it asserts about chosen actions.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A test can pass only by changing `packages/rules/src/api` or a path outside the owned paths.
- After three hours of work, the `unit` check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
