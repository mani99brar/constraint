import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { withTitle } from './src/title';

export const WEB_PORT = 5493;

/** Puts the game's title from `src/title.ts` into `index.html`, so it lives in one constant. */
export function titlePlugin(): Plugin {
  return { name: 'game-title', transformIndexHtml: (html) => withTitle(html) };
}

export default defineConfig({
  // Relative asset paths: the build runs from a subfolder, a file host or an itch.io upload (PRD E8).
  base: './',
  plugins: [react(), titlePlugin()],
  server: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
  preview: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
});
