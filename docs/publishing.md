# Publishing Constraint

Constraint is a plain static web page: one `index.html`, one script and one style sheet, with no server, service worker, network calls or analytics (PRD E8). Settings, the saved match and the results stay in the player's browser (`localStorage`).

## Build the bundle

```bash
npm ci
npm run build
```

The bundle is `apps/web/dist/`. The build uses relative asset paths (Vite `base: './'`), so the folder runs from a domain root, a subfolder or an upload service unchanged. Check it locally with `npm run preview --workspace @okiya/web` (http://127.0.0.1:5493). Opening `index.html` straight from disk (`file://`) does not work, because browsers refuse module scripts there. Serve the folder over HTTP instead.

## itch.io (HTML5)

1. Zip the *contents* of `apps/web/dist/`, so `index.html` sits at the top of the zip and not inside a folder:
   `cd apps/web/dist && zip -r ../constraint-web.zip . && cd -`
2. On itch.io, create a project (or edit one), set **Kind of project** to **HTML**, and upload `constraint-web.zip`. Tick **This file will be played in the browser**.
3. Under **Embed options**, choose **Click to launch in fullscreen**, or an embed size of at least 1024 × 768. Turn on **Mobile friendly** (the layout fits a 390 px wide phone) and **Fullscreen button**.
4. Save, then open the page and play a turn to check it.

## GitHub Pages

- **With a workflow (recommended):** in **Settings → Pages**, set the source to **GitHub Actions**. Add a workflow that runs `npm ci` and `npm run build`, uploads `apps/web/dist` with `actions/upload-pages-artifact`, and publishes it with `actions/deploy-pages`.
- **By hand:** copy the contents of `apps/web/dist/` to the root of a `gh-pages` branch, commit and push it, and select that branch in **Settings → Pages**.

The game runs at `https://<user>.github.io/<repository>/`. Relative paths make the repository subfolder work with no extra configuration.

## Any other static host

Copy the contents of `apps/web/dist/` to any folder the host serves (Netlify, Cloudflare Pages, S3, nginx or Apache). It needs no rewrites, redirects, headers or server code. Serve `index.html` as the folder's index page.

## Before each release

Run `npm run typecheck`, `npm run test:unit`, `npm run build` and the browser tests (`npx --no-install playwright test --config=tests/e2e/playwright.config.ts`). Then play one match on the published page. The game's name lives only in `apps/web/src/title.ts`: change it there and rebuild.
