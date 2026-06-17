import { defineConfig, devices } from '@playwright/test';

// e2e web do ops.fonte: roda contra o build web do Expo (expo export --platform web),
// servido localmente. Espelha o playwright.config.ts do adm.fonte.
//
// Pré-requisitos:
//   - API de teste no ar na porta 3001 (pnpm dev:api:test) para o login real.
//   - dist/ gerado apontando para a API de teste. A URL da API é embutida no
//     bundle em tempo de export, então o build precisa ser feito com
//     EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1 expo export --platform web.
//     O webServer abaixo apenas serve esse dist/ na porta 8083.
//
// Telas que dependem de API nativa (câmera/ImagePicker, push, áudio) NÃO são
// cobertas aqui — ficam só no Maestro (e2e/*.yaml). Ver os specs em e2e-web/.

const PORT = 8083;

export default defineConfig({
  testDir: './e2e-web',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
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
    // Serve o dist/ (export web do Expo). SPA fallback (-s) para o roteamento
    // client-side do expo-router.
    command: `npx serve dist -l ${PORT} -s`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
