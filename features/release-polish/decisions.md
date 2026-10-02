# Decisions: release-polish

From the requirements interview of 2026-10-02 with the operator.

## Decisions

- The game is published as **Constraint**. The title lives in one constant in `apps/web/src`; internal package names stay `@okiya/*`. Consequence: renaming later is a one-line change, and no `package.json` changes in this run.
- The playtest helpers are removed from the interface: seed field and display, URL parameters, preset choice, scenario choice and the preset-values rules panel. The game always plays `spec-v0.2`. Consequence: presets, variants and scenarios stay in `packages/content/src` for the engine's tests; browser tests fix randomness through Playwright's `addInitScript`, not an app parameter.
- Legal-move highlights stay, behind an on/off setting that is on by default and remembered. Consequence: refusal reasons still explain illegal moves when highlights are off; `highlight-toggle` proves both.
- The first-visit guide becomes a polished How to Play dialog, opened from the title screen and the match screen, covering matching, every fighter and the objective. Consequence: `how-to-play` replaces the playtest-ready `onboarding-guide` scenario.
- Bot difficulty (Easy 1, Normal 2, Hard 3) stays and moves to the New game flow.
- Visuals stay code-drawn and gain a title screen, icon and favicon; short sound effects are synthesized with the Web Audio API, with a remembered mute setting. Consequence: no image, font or audio files and no dependencies; sound starts only after a user gesture.
- An unfinished match is saved in the browser after every action and offered as Continue on the title screen. Consequence: `web` saves with `matchLogOf` and restores with `parseMatchLog` and `replayMatchSteps`, and `engine` hardens `parseMatchLog` so stored data that is corrupt or old is refused instead of throwing.
- Wins, losses and draws are kept per difficulty in the browser, shown on the title screen with a reset. No accounts and no network.
- The game is a plain static web page, not installable or offline: the build uses relative asset paths and runs on any static host or as an itch.io HTML5 upload, described in `docs/publishing.md`.

## Assumptions

- The How to Play dialog opens once by itself on the very first visit, then only from its buttons.
- Sound is on by default after the first user gesture, and the mute setting persists.
- The open playtest-ready review findings are fixed here: the ability prompt names the actor's tile, the total action count shows with nothing auto-selected, and `action-feedback` no longer depends on the bot's random private seed.
- `engine` does not change which action or setup the bot chooses for any input, so the `web` lane's fixed-randomness browser tests stay valid when the lanes combine.
- No lane adds dependencies or changes any `package.json`, `package-lock.json`, root config or `packages/rules/src/api`.
- The review sidecar reviews every five minutes, as in playtest-ready.
- The workers run with a four-hour deadline (`--worker-timeout-seconds 14400`).

## Deferred

- Log export, loading and step-through for players (PRD L2, L3).
- Installable offline play, accounts, online play and analytics.
- Artist-made images and recorded audio.
- The rule experiments from `~/dev/okiya-playtests` and the deferred playtest-ready items: the bot's public options, a Line objective, a draw after repeated single-option turns.
