import { test, expect } from '@playwright/test';

// e2e web do login do familiar (role RELATIVE). Espelha e2e/auth.yaml /
// e2e/helpers/login.yaml (Maestro), mas roda no build web do Expo, sem emulador.
// Exige a API de teste no ar (porta 3001) — o familiar é o seed
// `familiar@fonte.com` / `familiar123` (seed-test.ts), já com senha definida
// (must_change_password = false).
//
// Reproduzir: (1) pnpm dev:api:test (API teste :3001);
//             (2) pnpm --filter app.fonte build:web:test (gera dist/ apontando
//                 para :3001, com cache limpo — sem --clear o Metro reaproveita
//                 a URL :3000 padrão e o login falha);
//             (3) pnpm test:app:e2e (Playwright serve dist/ em :8084).
//
// O first-login set-password (familiar2@fonte.com / temp123, depois
// change-password) está coberto pelo Maestro (e2e/first-login-set-password.yaml):
// o fluxo web depende do bounce do expo-router entre (auth) e (app) que, no web,
// não é determinístico o suficiente para um gate — fica só no Maestro.
//
// Telas só-nativo NÃO cobertas aqui (ficam no Maestro): checkin por QR/câmera
// (expo-camera), envio de foto/documento (ImagePicker), gravação de áudio
// (expo-av), notificações push.

const RELATIVE_EMAIL = 'familiar@fonte.com';
const RELATIVE_PASSWORD = 'familiar123';

async function fillLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/');
  // accessibilityLabel vira aria-label no react-native-web.
  await page.getByLabel('input-email').fill(email);
  await page.getByLabel('input-senha').fill(password);
  await page.getByText('Entrar', { exact: true }).click();
}

test.describe('app.fonte — login web', () => {
  test('login válido leva à home do familiar', async ({ page }) => {
    await fillLogin(page, RELATIVE_EMAIL, RELATIVE_PASSWORD);

    // Nome do familiar logado (seed: Maria Testadora) no cabeçalho da home.
    await expect(page.getByText('Maria Testadora')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('login com senha incorreta mostra erro', async ({ page }) => {
    await fillLogin(page, RELATIVE_EMAIL, 'senha_errada');

    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({
      timeout: 30_000,
    });
  });
});
