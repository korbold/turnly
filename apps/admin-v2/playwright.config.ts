import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'https://staging.goturnly.com';

export default defineConfig({
  testDir: './e2e',
  // Staging es 1 vCPU y responde más lento que una laptop.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // La base es compartida: dos tests escribiendo el mismo día se pisan.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // El reintento absorbe la red, no tapa carreras. Un test que lo necesita
  // siempre está mal escrito y se arregla.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: /flows\/.*\.spec\.ts/,
    },
  ],
});
