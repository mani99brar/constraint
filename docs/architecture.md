# Architecture

npm workspaces, TypeScript everywhere, no server. No workspace has its own build: each `package.json` points `exports` and `types` at `src/`, and Vite bundles the packages from source into `apps/web`.

| Workspace | Responsibility | Depends on |
| --- | --- | --- |
| `packages/rules` | Pure rules engine: plain serializable state, legality, action application, per-player views, terminal checks, setup and match logs. Never imports DOM, rendering or network code, timers, wall-clock time or `Math.random`; randomness is pure-rand state kept in the match state. | `pure-rand` |
| `packages/content` | Typed data and validators: the 16 tiles, fighter definitions, objectives, the `spec-v0.2` preset, default setups and the paper test 01 scenario. Pure like `rules`. | `@okiya/rules` |
| `packages/bot` | The bot: `chooseSetup` and `chooseAction`, from its own player view and the legal-action list. Its generator is seeded by the view's seed and turn. | `@okiya/rules` |
| `apps/web` | React client. Holds the referee state, renders only the human's `playerView`, and schedules the bot's move from an effect. | all three |
| `tests/unit`, `tests/e2e` | Cross-package unit tests (bot, purity) and Playwright browser tests. | |

## `packages/rules`

- `src/api/`: the public entry point (`index.ts`) and every shared type: board and coordinates, fighters, `Preset`, `Scenario`, `Setup`, `MatchState`, `Action`, `ActionRefusal`, `SetupRefusal`, `Effect` and `AbilityModule`, `ResolutionEvent` and `PlayerEvent`, `PlayerView` with its public log and `reveal`, and `MatchLog`. Changing its shape needs its own small feature.
- `src/core/`: the turn engine behind the API.
- `src/abilities/`: one module per fighter behind `ABILITY_MODULES`, each returning `targets` and `resolve` (effects) that core applies.

Public functions:

| Function | Purpose |
| --- | --- |
| `prepareMatch({ tiles, preset, seed, scenario? })` | Setup phase one: shuffle and reveal the board. |
| `validateSetup(setup, preset)` | Structured setup refusals (distinct fighters, distinct trap cells, displacer limit, counts). |
| `startMatch(prepared, setups, scenario?)` | Setup phase two: apply both setups, pick the starting player. |
| `listLegalActions(state)` | One entry per concrete choice of the active player. |
| `validateAction(state, action)` | A structured `ActionRefusal`, or null. |
| `applyAction(state, action)` | The next state and its ordered resolution events, or a refusal. |
| `playerView(state, viewer)` | What one player may know; the client renders only this. |
| `projectEvents(events, viewer)`, `projectLogEntry(entry, viewer)` | Per-player projection that hides the other side's trap cells and inspection results. |
| `hypotheticalState(view)` | A full state from a view, with placeholders for hidden data, for bot lookahead. |
| `objectiveResult(state)`, `blockadeResult(state)` | Terminal checks. |
| `canonicalSignature(state)` | Start-of-turn signature for repetition. |
| `matchLogOf(state)`, `replayMatchLog(log, tiles)` | Match log export and deterministic replay (throws on a refused log). |
| `parseMatchLog(input)` | Reads an untrusted value as a `MatchLog`, or a structured `MatchLogRefusal` naming the bad field. |
| `replayMatchSteps(log, tiles)` | Every intermediate state of a replay, for step-through and continuing from any point, or the first refused setup or action. |

The skeleton implements deploy, move, the opening rule, Square and blockade. Abilities are stubs offering no targets, traps are stored but never triggered, and the repetition draw is not enforced; core already validates recharge and applies every effect kind, but nothing can spend a charge yet. The `full-rules` feature fills these in.
