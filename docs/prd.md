# Constraint (formerly the working title Okiya): product requirements v0.3

Status: draft of 2026-10-02, revised after paper test 01. Companion documents, all in this directory: `game-spec.md` v0.2 (the rules), `paper-simulation.md` (the playtest protocol) and `paper-test-01.md` (the first playtest's ledger, edge-case walkthroughs and findings).

## 1. Authority

- `game-spec.md` is the authority for gameplay rules. This document never restates a rule differently; where it cites one, the spec section (§) governs.
- This document is the authority for the product: what is built, how it is presented, and how it is delivered.
- Every value the spec marks **Provisional**, or lists in its §13 "Prototype defaults requiring validation", is data in a rules preset (section 6), never a constant in engine code. So are the rule variants that paper test 01 left open. Playtest findings change presets or the spec, not this document's structure.
- The working name gave no rights to the existing Okiya name or branding. The published game is called **Constraint** (operator decision of 2026-10-02); internal package names keep `okiya`.

## 2. Product summary

A single-player browser game: one human plays the full two-player rules of `game-spec.md` against a heuristic bot. The board is the 4×4 grid of 16 terrain/symbol tiles, each side fields four fighters, traps are secret, and the first player to arrange all four fighters in a 2×2 square wins.

Goals:
- A complete, correct implementation of the spec's rules, so the game itself can serve as the next playtest after the paper simulation.
- An opponent good enough that a human must predict, constrain and set traps to win.
- Rule values that change without code, so findings from playtests are cheap to apply.
- Reproducible matches, so every bug and every interesting game can be replayed exactly.

Non-goals for v1: online play, local hotseat, a headless self-play simulator, accounts, matchmaking, objectives other than Square, artist-made images and recorded audio (visuals are drawn in code and sound is synthesized, §5.8).

## 3. Decisions from the requirements interview

| Topic | Decision | Consequence |
| --- | --- | --- |
| Play mode | Versus bot only | No server. The whole game runs in the browser. |
| Bot and simulator | Heuristic bot, no simulator | Balance evidence comes from human play and match logs, not bot-vs-bot statistics. |
| Rule values | Rules presets as data | Provisional values live in a named, validated preset; a match records its preset. |
| Rules scope | Full spec, Square only | All 9 fighters, traps, recharge, locks, protection, blockade and repetition. |
| Devices | Desktop first, responsive | Mouse on desktop is primary; the layout and tap targets also work on a phone. |
| Rendering | DOM and SVG with React | The board is readable by browser tests and screen readers; animation stays modest. |
| Replay | Deterministic seed and action log; export, loading and step-through deferred beyond v1 | Every match is reproducible from its log (L1); scenario files can set up a fixed start. Export and replay screens (L2, L3) were dropped from v1 in favour of UI and UX work (U4–U7). |
| Trap Checker (after paper test 01) | Spec v0.2 single-cell rule | The spec is updated; the engine implements only the new rule. |
| Open rules from paper test 01 | As written, variants as preset switches | Puller on allies, locked fighters counting toward Square, and Anchor duration can be flipped per match for playtesting. |
| Roster balance | Free choice, optional displacer limit | Default stays free choice; a preset can cap displacers per roster. |

## 4. Users and experience

The player is the game's designer and early playtesters: people who know or are learning the rules and want to feel whether they work. They need the rules enforced exactly, the reason for every refusal, and a way to share a match that went wrong.

The experience the spec targets (§1) should come through: reading the bot's intent from its public actions, steering it with the constraint you hand over, and traps that pay off over several turns.

## 5. Functional requirements

### 5.1 Match setup

- **S1.** The player starts a match against the bot from the landing page, choosing a rules preset (default: the paper preset of section 6) and optionally a seed. With no seed, one is generated and shown.
- **S2.** Setup follows spec §5 in order: the seeded shuffle reveals the board; both sides receive Square as their objective (spec §10); the player secretly picks four distinct fighters from the nine, within the preset's displacer limit if it sets one; the player places the preset's number of setup traps on distinct cells of the revealed board; the bot does the same from its own view, drawing its setup from a private seed that is independent of the match seed and never shown, so the displayed seed cannot reveal its traps; the seeded generator picks the starting player. The match log records both setups, so replays do not need the private seed.
- **S3.** The player's objective, roster and traps are shown only to the player. The bot's roster identities, traps and objective are never rendered while the match is running.
- **S4.** A scenario file may replace any part of setup (board layout, rosters, traps, starting player) for testing. Built-in scenarios: the paper test 01 fixture with its rosters, traps and starter (`paper-test-01.md`, Fixture), and the report's next test, the same fixture with B starting and the rosters swapped.

### 5.2 Turns and rules

- **R1.** The rules engine implements spec §6–§12 completely: the matching constraint, the four action kinds, all nine fighters, trap triggering and effects, locks, protection, objective checks, blockade defeat, repetition draws, and the terminal ordering of §11.
- **R2.** The opening deployment follows the preset's opening rule (spec §5 step 7: an outside-edge cell with no constraint).
- **R3.** On the player's turn, the interface offers only legal actions. Selecting a fighter highlights its legal destinations or targets; selecting a reserve fighter highlights legal deployment cells.
- **R4.** An attempted illegal action is refused with the reason (for example "Desert–Moon does not match Forest or Star"), spends nothing and does not end the turn (spec §11).
- **R5.** Each action is resolved and shown in order: positions, trap triggers, charge loss or lock, the new constraint, then the objective and blockade checks.
- **R6.** The match ends on a win, a draw by simultaneous objective, a draw by repetition, or a blockade defeat. The end screen states which, and reveals both objectives, both rosters and every trap that was ever placed, including where they were.

### 5.3 Information shown

- **I1.** Always visible: the board with tile terrain and symbol, deployed fighters with owner, type, charge, lock and protection, the current constraint, the active player, both recharge budgets, both deployed counts, and the player's own live traps.
- **I2.** A public action log lists every action in spec notation (cells A1–D4), with trap placement shown as "Trapper placed a trap" without its cell, and Trap Checker results visible only for the player's own inspections (spec §4).
- **I3.** A rules reference panel summarises spec §6–§9 and shows the active preset's values.
- **I4.** The bot's hidden state never reaches the rendering layer: the client renders only the player's view from the rules engine. Because v1 runs entirely in the browser, this is a presentation guarantee, not protection against inspecting the page.

### 5.4 Bot

- **B1.** The bot chooses one legal action per turn from its own player view only. It never reads the human's traps, reserve identities or inspection results.
- **B2.** It follows the spec's move-priority guide (`paper-simulation.md` §7): take an immediate win; never complete only the opponent's square when another action exists; disrupt a visible threat; prefer actions that leave itself legal moves next turn and the opponent fewer; weigh spending charges against trap risk on cells it has not inspected. Paper test 01 adds two priorities: occupy the hole of a three-fighter square, which was the strongest defence (F2), and count every entry mode into a hole (walking, pulling the fourth fighter, swapping a blocker), since a threat with several modes could not be stopped (F1).
- **B3.** Its choices are deterministic for a given state and seed, so replaying a log reproduces the bot's turns.
- **B4.** A bot turn takes no more than one second on a mid-range laptop, and its action is shown with a short pause so the player can follow it.

### 5.5 Rules presets

- **P1.** A preset is typed data with an id, a version, every provisional value of spec §13 and the rule-variant switches of section 6. A validator rejects impossible presets (for example a negative recharge budget, a repetition threshold below two, or a displacer limit above four).
- **P2.** The built-in preset `spec-v0.2` holds the spec's current defaults (section 6). The player may choose another built-in preset, and the match screen always shows which preset is active and how it differs from `spec-v0.2`.
- **P3.** A match records its preset id, version and full values, so an old log replays under the rules it was played with.

### 5.6 Replay and logs

- **L1.** Every match has a seed. The rules engine is deterministic: the same preset, seed, setup choices and action list always give the same states.
- **L2** (deferred beyond v1). The player can export a match at any time as one JSON file: format version, preset, seed, scenario if any, both setups and the full action list. The export warns that it contains the bot's hidden information.
- **L3** (deferred beyond v1). The player can load an exported match and step through it turn by turn, forward and back, with the full referee view, or continue playing from any point.

### 5.7 Presentation

- **U1.** Placeholder visuals: terrain as colour plus a text or icon label, symbols as icons with text labels, fighters as labelled tokens. Colour is never the only signal.
- **U2.** Desktop first. At a phone width of 390 px the board, the constraint and the action controls fit without horizontal scrolling, and every tap target is at least 44 px.
- **U3.** Every cell and fighter is reachable by keyboard and has an accessible name, for example "B3, Water–Moon, your Pusher, charged".
- **U4. Visual design.** A consistent theme in light and dark that follows the system colour scheme: distinct terrain colours with shape or text labels, symbol icons, and fighter tokens that read at a glance, all drawn in code. Text meets a 4.5:1 contrast ratio.
- **U5. Turn clarity.** Without reading the log, the player always sees whose turn it is, the constraint in words, what they can do now and why a move is refused. During the bot's turn the controls are disabled and the screen says so.
- **U6. Action feedback.** Every action, the bot's reply included, is shown on the board: the cells it involved are highlighted and trap triggers are called out, with short animations that never block input and are off under reduced motion.
- **U7. Onboarding.** A short first-match guide explains matching, the fighters and the objective in context. It can be dismissed, stays dismissed, and reopens from a help button.

### 5.8 Release (feature `release-polish`)

The playtest build becomes the published game **Constraint**. Where this section differs from §5.1–§5.7, it governs.

- **E1. Helpers removed.** The interface offers no seed, preset, scenario or preset-values panel and reads no URL parameters; the game always plays `spec-v0.2`. This replaces S1's preset and seed choice and S4's scenario choice in the interface; presets and scenarios remain as data for tests.
- **E2. Title screen.** New game (difficulty, then setup), Continue when a match is saved, How to play, results by difficulty and the settings.
- **E3. How to Play.** A polished dialog, opened from the title and match screens, explaining matching, every fighter and the objective. It replaces U7's first-visit guide and I3's rules panel.
- **E4. Highlight setting.** Legal-move highlights (R3) can be turned off; refusal reasons (R4) remain either way.
- **E5. Sound.** Short effects synthesized with the Web Audio API, starting only after a user gesture, with a remembered mute setting; never the only signal of an event.
- **E6. Resume.** An unfinished match is saved in the browser after every action and restored on Continue; a corrupt or old save is discarded safely.
- **E7. Results.** Wins, losses and draws per difficulty, kept only in the browser, with a reset.
- **E8. Publishing.** The build is a static site with relative asset paths that runs on any static host or as an itch.io HTML5 upload, described in `docs/publishing.md`. No service worker, accounts, network calls or analytics.

### 5.9 Tabletop interface (feature `tabletop-ui`)

The match screen is a tabletop. Where this section differs from §5.1–§5.8, it governs.

- **T1. Board only.** No log, last-actions, status, reserve-list, legend or settings panel. This replaces I2's persistent log: events are shown when they happen, as toasts and last-move marks, and no history stays on screen.
- **T2. Piece trays.** Unplaced fighters are tokens in a tray (the bot's face-down), hidden once empty; deploying is tapping a tray token, then a cell.
- **T3. Actions on the piece.** Tapping a token shows its move cells and, beside it, its ability and recharge buttons.
- **T4. Top bar.** Whose turn, the constraint as two emblems, recharge pips for both sides, a goal chip and a menu (How to Play, highlights, sound, quit to title).
- **T5. Tokens and cells carry state.** Charge, lock and protection on tokens; own traps and inspected marks on cells (I1).
- **T6. Look.** Illustrated square tiles in a framed tray and round emblem tokens, original art drawn in code, in light and dark.

## 6. Rules preset `spec-v0.2`

These are the spec's provisional defaults as of v0.2, after paper test 01. Change them here and in the preset data together. Rows marked *variant* are switches paper test 01 left open; the default is the spec as written.

| Value | Default | Spec |
| --- | --- | --- |
| Shared recharge actions per player | 3 | §3, §13 |
| Setup traps per player | 2, on distinct cells, any cell allowed | §5 |
| Live traps per owner per cell | at most 1 | §8.3 |
| Opening deployment | outside-edge cell, no constraint; traps can trigger on it | §5 |
| Lock duration | the fighter misses exactly one of its owner's turns; reapplying extends, never stacks | §8.2 |
| Anchor protection, *variant* | through the end of the opponent's next turn; switch: also through the owner's following turn, which makes the "already protected" clause reachable | §9; paper test 01 D2, R2 |
| Trap Checker | one chosen adjacent cell, empty or enemy-occupied; removes enemy traps there; legal with nothing found | §9 v0.2; paper test 01 D1 |
| Puller may target allies, *variant* | yes; switch: enemies only | §9; paper test 01 R4 |
| Locked fighters count toward the objective, *variant* | yes; switch: a locked fighter does not count while locked | §8.2, §10; paper test 01 recommendation 4 |
| Displacers per roster, *variant* | no limit; switch: at most N of Pusher, Puller and Swapper | §4; paper test 01 B1 |
| Trapper | charge is the only trap supply; destination need not match; constraint unchanged | §9 |
| Same fighter types on both rosters | allowed | §4 |
| Repetition draw | third occurrence of the same full start-of-turn state | §12 |
| Terminal precedence | objective, then blockade, then repetition | §11 |
| Objective pool | Square only, assigned to both players | §10 |

## 7. Technical constraints

- TypeScript, npm workspaces, Vite, React, Vitest and Playwright, with exact pinned versions. No server.
- `packages/rules` is the pure rules engine: plain serializable state, legal-action listing, action application, per-player view, terminal checks and a canonical state signature for repetition. It holds the abilities as separate modules behind one shared ability interface.
- `packages/content` holds tiles, fighter definitions, objectives, presets and scenarios as typed data with validators.
- `packages/bot` chooses an action from a player view and the legal-action list.
- `apps/web` is the React client. It talks to the engine only through its public API and renders only the human's player view.
- The pure packages never import DOM, rendering or network libraries, timers, wall-clock time or `Math.random`. All randomness comes from a seeded generator kept in the state.

## 8. Quality and acceptance

- Every rule in spec §6–§12 has a unit test that names the spec section it proves.
- Every case in `paper-simulation.md` §8 becomes a unit test. Its state and expected outcome come from the walkthrough in `paper-test-01.md` (Phase B), which resolved all 45 cases under spec v0.2. A case the spec cannot decide is reported, not guessed.
- The paper test 01 match replays as a regression test: its fixture and its 28 recorded actions end with B winning by Square on action 28, and the legal-action count before each action equals the report's list under its counting convention. The ledger was kept by hand: where the engine and the report disagree and the spec shows the report is wrong, the test records the corrected value with the spec section and the turn, and never bends the engine to match.
- Each rule-variant switch of section 6 has a unit test showing the behaviour change it makes.
- Determinism: a fixed preset, seed and action log give the same final state signature every run.
- Hidden information: a unit test proves that a player view never contains the other side's traps, reserve identities, objective or inspection results.
- The bot only ever returns actions from the legal-action list, and a test proves it takes an available immediate win.
- Browser tests cover setup, a legal turn and a refused illegal action, a trap trigger, a full match to an end screen, turn clarity, action feedback, the onboarding guide and the dark theme, at a desktop and a phone viewport.

## 9. Delivery plan

Features run with the workflow controller (see `CLAUDE.md` and `features/README.md`). A lane is verified alone, so lanes split only along APIs already on `main`.

1. **`skeleton`, one lane.** The workspaces, toolchain and every shared API. That covers the full state shape (charges, traps, locks, protection, repetition history), the union of all action kinds, the effect-based ability contract, two-phase setup with a setup validator, resolution events, the player view with its redacted public log, the bot's setup and action choices, the preset and scenario types, and the match log format. Behind it sits a thin playable path: start a match, deploy and move under the matching constraint and opening rule, win by Square or lose by blockade, against a bot that picks a random legal action. Abilities, traps, recharge, locks, protection and repetition exist as types only.
2. **`full-rules`, parallel lanes:**
   - `rules`, owning `packages/rules/src/core` and `packages/rules/src/abilities`: recharge, traps, locks, protection, the terminal ordering, repetition and the nine fighters behind the effect-based ability contract, with all 45 edge cases, the paper test 01 replay and the variant switches. Core and abilities stay in one lane because trap, lock and ability resolution are entangled and most edge cases need both (design challenge of the skeleton run, attempt 1).
   - `bot`, owning `packages/bot`: the heuristic bot against the legal-action list and player view.
   - `web`, owning `apps/web` and `tests/e2e`: setup screens, legal-move highlighting, refusal reasons, the action log, the rules panel and the end screen, driven by the legal-action list so new abilities appear without UI changes.
3. **`playtest-ready`**, two lanes: `engine` (two playtest presets, replay determinism with abilities, the bot's open review findings) and `ux` (visual design, turn clarity, action feedback and onboarding, U4–U7; presets, scenarios, seeds and bot depth at match start; phone layout and keyboard access; a full-match browser test). Log export, loading and step-through (L2, L3) were dropped from v1 by the operator on 2026-10-02.
4. **`release-polish`**, two lanes: `engine` (safe replay of stored logs, a reliable bot timing proof) and `web` (§5.8: helpers removed, title screen, How to Play, highlight and sound settings, synthesized sound, resume, results, a static build and `docs/publishing.md`), plus the open playtest-ready review findings.
5. **`tabletop-ui`**, one lane `web`: the tabletop interface of §5.9.

## 10. Risks and open questions

- The paper simulation may change rules or defaults. Presets absorb value changes; rule changes need a spec revision before the features that implement them run.
- Square for both players removes objective deduction from v1 (spec §10). A random objective pool needs validated objectives first.
- A heuristic bot may be easy to exploit once its priorities are learned. A stronger search bot is a later feature.
- Hidden information is only hidden in the interface; a determined player can read it from the page. That is acceptable for a single-player test build and must change before any online play.
- The spec's §13 balance risks (trap guessing at setup, Trap Checker or Trapper dominance, Anchor turtling, abrupt blockades) are tested by play, not solved by this document.
- Paper test 01 is one open-information game played by one referee for both sides. Its findings are signals, not balance results: displacer count decided the game (F2), three-plus-one squares were nearly unstoppable (F1), options fell to a median of 5.5 after deployment (F5), recharges and trap actions worked as paid passes (R3), and traps never touched the objective (F4).
- Hidden-information play (the report's Phase C) never ran on paper. Playing against the bot is the first test of it, so match logs from early play are evidence to keep.
