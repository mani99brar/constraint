import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: '**/*.spec.ts', fullyParallel: true, retries: 0, workers: 3, reporter: 'list', outputDir: '../../test-results', use: { baseURL: 'http://127.0.0.1:5494', contextOptions: { reducedMotion: 'reduce' } }, projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }] });
