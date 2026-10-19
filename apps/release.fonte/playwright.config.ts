import { defineConfig, devices } from '@playwright/test';

// Vite dedicado (porta 5178) em `--mode e2e`: nesse modo o publicDir é
// e2e/public, que serve a fixture /downloads/latest.json. O release.fonte não
// tem backend — nada externo é chamado nesta suíte.
const PORT = 5178;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec vite --mode e2e --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
