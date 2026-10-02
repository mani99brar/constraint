# Decisions: skeleton

From the grill session of 2026-10-02 with the operator.

## Decisions

- `packages/rules` has three directories. `src/api/` holds the state, action, player-view, refusal, preset, scenario and match-log types and the package's public entry point. `src/core/` holds the turn engine. `src/abilities/` has one module per fighter behind a registry, and each module is a stub that offers no activations yet. Consequence: the later `full-rules` lanes `core` and `abilities` each own one directory and build against `src/api/`, which neither owns. Changing the shape of `src/api/` needs its own small feature first.
- The legal-action list has one entry per concrete choice. A deploy or move is one entry per fighter and cell. An ability is one entry per actor and target cell. A recharge is one entry per fighter. This is the counting convention of `docs/paper-test-01.md`. Consequence: the web client highlights by filtering this list and the bot picks from it. The later replay test compares counts with the report directly.
- Any single action can be validated on its own and returns a structured refusal (a reason code plus its data) instead of English text. Consequence: the web client turns refusals into the readable reasons PRD R4 asks for, and tests check codes, not wording.
- The landing page takes an optional seed in a field or as `?seed=` in the URL. The seed decides the board shuffle and the starting player, as spec §5 says. A match started without one generates a seed and shows it. If the bot starts, it makes the opening edge deployment before the human's first turn.
- Browser tests check the interface only: what is shown, highlighted, refused and handed back. Rule correctness belongs to the `unit` check. Consequence: `start-match` and `legal-turn` assert visible UI behaviour and may use a fixed seed where the human starts. They do not assert rule outcomes the unit tests already prove.

## Assumptions

- The fixed default roster gives the human Teleporter, Pusher, Trap Checker and Terrain Weaver, and the bot Swapper, Upgrader, Puller and Trapper, as in `docs/paper-test-01.md`. The fighters exist as data, but their abilities are stubs.
- Outcomes that deploy and move alone cannot reach, such as a simultaneous-completion draw, are unit-tested on constructed states through the engine's terminal check. Blockade defeat is tested the same way.
- The state carries repetition history and the canonical-signature type, but the repetition draw is not enforced yet.
- The preset type includes every value and variant switch in `docs/prd.md` §6, set to its default. Only the values that deploy, move, the opening rule and Square use change behaviour in this feature.
- The paper test 01 fixture (board, rosters, traps, starter) ships as scenario data in `packages/content`. A unit test validates it, which proves the scenario type can describe it.
- The match log is JSON with a format version, the preset's id, version and values, the seed, the scenario if any, both setups and the action list in the `src/api/` action type. Saving and loading it from the interface is deferred.
- The bot is deterministic for a given state and seed. Any pause before its move lives in `apps/web`, not in `packages/bot`.
- `packages/bot` depends only on the public entry point of `packages/rules`.

## Deferred

- The behaviour of recharge, abilities, traps, locks, protection and repetition draws, and the rule-variant switches (the `full-rules` feature).
- Roster selection and trap placement screens, and the heuristic bot (`full-rules`).
- The replay of the paper test 01 match, and the 45 edge cases as unit tests (`full-rules`).
- Log export, loading and step-through, the built-in scenarios in the interface, choosing a preset at match start, and the phone layout and keyboard access (`playtest-ready`).
