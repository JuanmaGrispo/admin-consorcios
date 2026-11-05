import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './acceptance', testMatch: '*.e2e.ts', workers: 1, fullyParallel: false,
  timeout: 90_000, expect: { timeout: 15_000 },
  outputDir: path.resolve(__dirname, '../backend/acceptance/resultados/web'),
  reporter: [['list'], ['json', { outputFile: '../backend/acceptance/resultados/web/reporte.json' }]],
  use: { baseURL: 'http://127.0.0.1:3300', browserName: 'chromium', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
});
