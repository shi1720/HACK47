import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          'NODE_ENV=production npx vite build --config tests/e2e/vite.config.ts && node scripts/precache.mjs dist-e2e && npx concurrently -k "tsx server/index.ts" "vite preview --config tests/e2e/vite.config.ts --host 127.0.0.1 --port 5175"',
        url: 'http://localhost:5175',
        timeout: 120_000,
        reuseExistingServer: false,
        env: {
          DATABASE_PATH: './data/e2e.sqlite',
          APP_ORIGIN: 'http://localhost:5175',
          HOST: '127.0.0.1',
          PORT: '3002',
          NODE_ENV: 'development',
        },
      },
});
