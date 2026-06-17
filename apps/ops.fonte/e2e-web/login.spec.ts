import { test, expect } from '@playwright/test';

// e2e web do login do operador. Espelha e2e/auth.spec.yaml (Maestro), mas roda
// no build web do Expo, sem emulador. Exige a API de teste no ar (porta 3001)
// — o operador é o seed `operator@fonte.com` / `operator123` (seed-test.ts).
//
// Reproduzir: (1) pnpm dev:api:test (API teste :3001);
//             (2) pnpm --filter ops.fonte build:web:test (gera dist/ apontando
//                 para :3001, com cache limpo — sem --clear o Metro reaproveita
//                 a URL :3000 padrão e o login falha);
//             (3) pnpm test:ops:e2e (Playwright serve dist/ em :8083).
//
// Telas só-nativo NÃO cobertas aqui (ficam no Maestro): captura de foto via
// expo-image-picker, notificações push, gravação de áudio (expo-av).

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

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

test.describe('ops.fonte — login web', () => {
  test('login válido leva ao dashboard com boas-vindas', async ({ page }) => {
    await fillLogin(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);

    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Operador Teste')).toBeVisible();
  });

  test('login com senha incorreta mostra erro', async ({ page }) => {
    await fillLogin(page, OPERATOR_EMAIL, 'senha_errada');

    await expect(
      page.getByText('E-mail/telefone ou senha incorretos.'),
    ).toBeVisible({ timeout: 30_000 });
  });
});
