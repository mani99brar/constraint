# Okiya (working title)

An original two-player tactical board game on a 4×4 board of terrain/symbol tiles, played in the browser by one human against a bot. The rules are `docs/game-spec.md`, the product requirements `docs/prd.md` and the code layout `docs/architecture.md`.

## Requirements

Node 24 and npm 11. The browser tests use Playwright's Chromium for `@playwright/test` 1.63.0, which must already be installed in `~/.cache/ms-playwright`.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Dev server (http://127.0.0.1:5493) | `npm run dev` |
| Type-check every workspace | `npm run typecheck` |
| Unit tests (Vitest) | `npm run test:unit` |
| Browser tests (Playwright, starts the dev server) | `npx --no-install playwright test --config=tests/e2e/playwright.config.ts` |
| Build (type-check packages, `vite build` of `apps/web`) | `npm run build` |

`npm run test:e2e` is a shortcut for the browser tests. Stop any running `npm run dev` first: the port is fixed and strict.

## Workspaces

- `packages/rules`: the pure rules engine and its public API.
- `packages/content`: tiles, fighters, objectives, presets and scenarios as typed data with validators.
- `packages/bot`: the bot's setup and action choices.
- `apps/web`: the React client.
