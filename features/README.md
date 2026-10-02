# Okiya features

Each directory with a `feature.json` is a workflow feature (see the operator notes in `CLAUDE.md`).

## Order

1. `skeleton`, one lane. It puts the repository layout, the toolchain and the shared APIs on `main`: the rules engine's state, legal-action listing, action application and per-player view in `packages/rules`, and typed content in `packages/content`.
2. Features from `docs/prd.md`, each with parallel lanes that own disjoint paths and meet only at APIs already on `main`.

## Planned lane split (`docs/prd.md` §9)

| Feature | Lane | Owns | Builds against |
| --- | --- | --- | --- |
| `full-rules` | `rules` | `packages/rules/src/core`, `packages/rules/src/abilities` | `packages/rules/src/api`; the 45 edge cases and the 28-action replay from `docs/paper-test-01.md`, and the preset variant switches |
| `full-rules` | `bot` | `packages/bot` | the player view, the hypothetical state and the legal-action list |
| `full-rules` | `web` | `apps/web`, `tests/e2e` | the player view, the event projection and the legal-action list, so new abilities appear without UI changes |
| `playtest-ready` | `engine` | `packages/rules/src/core`, `packages/rules/src/abilities`, `packages/content/src`, `packages/bot/src`, `tests/unit/bot.test.ts` | two playtest presets, replay determinism and the bot's open review findings |
| `playtest-ready` | `ux` | `apps/web/src`, `apps/web/index.html`, `tests/e2e` | visual design, turn clarity, action feedback and onboarding; presets, scenarios and bot depth at start; phone and keyboard; a full-match browser test |

Core and abilities share one lane because trap, lock and ability resolution are entangled (skeleton design challenge, attempt 1). `packages/rules/src/api` and `package-lock.json` belong to no parallel lane: change them in a small feature on `main` first.

When a lane needs a new shared type or function, add it to `main` in a small feature first, then fan out. Do not give two lanes the same owned path.

## New feature

```bash
workflow init <feature>          # scaffold features/<feature>/ with TODO: placeholders
# add a workers entry to feature.json and policy.json, and a <lane>-task.md, per extra lane
/workflow-grill <feature>        # in Claude Code: writes decisions.md
workflow launch <feature> --dry-run
```
