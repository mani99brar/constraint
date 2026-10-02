# Task: web

## Goal

Make `apps/web` look and play like a finished tabletop game. The board is the whole interface, framed as a tray of illustrated tiles. Fighters are tokens: unplaced ones wait in trays, and a token's actions appear on the token itself. A slim top bar and short toasts carry the rest. Every developer panel is gone: the log, last actions, status, reserve list, "on the board" list, legend and settings panel.

## Context

- Read `docs/prd.md` (§5 and the tabletop changes in §5.9, which override earlier interface requirements), `features/tabletop-ui/decisions.md`, `docs/architecture.md`, and the current client in `apps/web/src` with its browser tests in `tests/e2e/`. The current match screen puts the board on the left and stacks panels on the right. Your job is to replace that layout, not restyle it.
- The rules, bot, save, results, sound and theme logic stay; this is a presentation rewrite on top of them. `@okiya/content` `FIGHTERS` and `OBJECTIVES` hold the names and summaries.

## Constraints

- Change only `apps/web/src`, `apps/web/index.html` and `tests/e2e`. Never change `packages/`, any `package.json`, `package-lock.json`, root configs, `docs/` or `features/`. Add no dependencies, and no image, font or audio files: all art is inline SVG or CSS, original, and does not imitate the published Okiya game's artwork or branding.
- Where information goes:
  - **Top bar:** whose turn ("Your turn" or "Bot is thinking"), the constraint as two emblems (terrain and symbol, each with its name), recharge pips for both sides, a small goal chip that opens How to Play at the objective, and a menu button.
  - **Tokens:** owner, fighter emblem and name (or initials when small), charge, lock and protection, drawn on the token and in its accessible name.
  - **Board cells:** terrain scene and symbol emblem large enough to read at a glance; the player's own live traps as a small marker, with "inspected by the bot, may have been removed" after a bot inspection.
  - **Trays:** the player's unplaced tokens under the board, the bot's as face-down tokens above it; a tray hides once it is empty.
  - **Toasts:** short, non-blocking notices for events the board cannot show by itself (a trap triggered, a charge lost, a lock applied, the bot placing a hidden trap, the player's own Trap Checker result, a refused move with its reason), queued in spec §11 order from projected events.
  - **Last move:** the cells the latest action involved stay marked on the board until the next action.
  - **Menu dialog:** resume, How to Play, the highlight and sound settings, and quit to title (the saved match is kept).
- Selection: tap a token on the board and its move cells glow; its ability and recharge buttons appear beside the token when they are legal; choosing the ability makes its targets glow; tapping elsewhere cancels. With highlights off nothing glows, and moves and refusals work as before.
- During play, render only the human's player view (PRD I4). Keep the StrictMode-safe bot scheduling, reduced-motion handling, both themes, the saved match, the results, the synthesized sound and port 5493. Animations stay under 400 ms and never block input.
- Logic lives in plain TypeScript modules with unit tests, and React components stay thin: the top bar model, the token state, the tray contents, the on-token action buttons, the toast queue and the last-move cells.
- Browser tests fix the page's randomness through `addInitScript`, read cells and tokens from the page, and never wait on an animation.

## Acceptance

- Unit (`npm run test:unit`):
  - the match screen renders no log, last-actions, status, reserve-list, on-the-board, legend or settings panel;
  - the top bar model gives the turn text, the two constraint emblems and both sides' recharge pips for a hand-built view;
  - the on-token buttons for a selected fighter are exactly its legal ability and recharge actions from a hand-built legal-action list, and its glowing cells are exactly its legal move or ability targets;
  - the tray holds exactly the player's reserve, and the bot's tray shows only its reserve count;
  - projected events become toasts in spec §11 order, a bot Trapper placement shows no cell, and the player's own Trap Checker result shows only to the player;
  - every token's accessible name states owner, fighter, cell, charge, lock and protection.
- Build (`npm run build`) passes.
- Browser, with scenario ids exactly as `policy.json` spells them: `title-screen`, `setup-flow`, `match-screen`, `piece-tray`, `piece-actions`, `legal-turn`, `highlight-toggle`, `event-toast`, `how-to-play`, `resume-match`, `full-match`, `sound-toggle`, `dark-theme`, `phone-layout` and `keyboard-play`. `phone-layout` runs at a 390 px viewport, `dark-theme` emulates the dark colour scheme, and `full-match` fails after 200 actions.

Browser checks: each scenario id appears in exactly one test title as `[scenario:<id>]`, and that test, when it passes, attaches exactly one image/png named `screenshot:<id>` (other attachments are fine). The verifier refuses anything else. Before completing, run the spec files you changed with a JSON report:

```bash
WORKFLOW_VERIFICATION_PHASE=worker PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/report.json \
  npx --no-install playwright test --config=tests/e2e/playwright.config.ts --reporter=json <spec files>
```

Then check the report with the verifier's own rules: run the exact `check-report` command the controller appends to this task when it pins it.

## Stop

Report `blocked` instead of continuing when any of these happens:

- A required screen needs a field or export that `@okiya/rules`, `@okiya/content` or `@okiya/bot` does not offer.
- A check can pass only by changing a path outside the owned paths.
- After three hours of work, any required check still fails and you cannot name the next fix.

Report `question` only for a choice that would change this acceptance.
