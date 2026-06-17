import { defineConfig, devices } from '@playwright/test';

// Sobe um Vite dedicado do portal (porta 5176, isolada do dev normal 5175 e
// do adm 5173/5174) para a suíte e2e. Todos os endpoints públicos são mockados
// via page.route nos specs — a API real nunca é chamada nesta suíte.
const PORT = 5176;
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
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: baseURL,
    // Sempre sobe um servidor próprio na porta dedicada (evita reusar o adm/dev).
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
