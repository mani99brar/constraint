# Okiya features

Each directory with a `feature.json` is a workflow feature (see the operator notes in `CLAUDE.md`).

## Order

1. `skeleton`, one lane. It puts the repository layout, the toolchain and the shared APIs on `main`: the rules engine's state, legal-action listing, action application and per-player view in `packages/rules`, and typed content in `packages/content`.
2. Features from `docs/prd.md`, each with parallel lanes that own disjoint paths and meet only at APIs already on `main`.

## Planned lane split (`docs/prd.md` §9)

| Feature | Lane | Owns | Builds against |
| --- | --- | --- | --- |
| `full-rules` | `core` | `packages/rules/src/core` | the state shape from the skeleton; non-ability edge cases from `docs/paper-test-01.md` Phase B, and the replay of its 28-action match |
| `full-rules` | `abilities` | `packages/rules/src/abilities` | the ability interface from the skeleton; the eight fighters, their edge cases and the preset variant switches |
| `full-rules` | `bot` | `packages/bot` | the legal-action list and the player view |
| `full-rules` | `web` | `apps/web`, `tests/e2e` | the legal-action list, so new abilities appear without UI changes |
| `playtest-ready` | to plan | | log export and replay, scenarios, presets at match start, phone and keyboard |

When a lane needs a new shared type or function, add it to `main` in a small feature first, then fan out. Do not give two lanes the same owned path.

## New feature

```bash
workflow init <feature>          # scaffold features/<feature>/ with TODO: placeholders
# add a workers entry to feature.json and policy.json, and a <lane>-task.md, per extra lane
/workflow-grill <feature>        # in Claude Code: writes decisions.md
workflow launch <feature> --dry-run
```
