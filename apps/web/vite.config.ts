import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export const WEB_PORT = 5493;

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
  preview: { host: '127.0.0.1', port: WEB_PORT, strictPort: true },
});
