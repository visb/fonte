import { test, expect, type Page } from '@playwright/test';

// e2e web do fluxo central do familiar: após login, a home carrega os dados do
// acolhido e da casa (espelha e2e/home.yaml do Maestro). Em seguida abre a tela
// de perfil. Não cobre fluxos que dependem de API nativa (checkin por câmera/QR,
// envio de foto, áudio, push) — esses ficam só no Maestro (e2e/*.yaml).
//
// Exige a API de teste no ar (porta 3001), seed `familiar@fonte.com`.

const RELATIVE_EMAIL = 'familiar@fonte.com';
const RELATIVE_PASSWORD = 'familiar123';

async function loginAsRelative(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(RELATIVE_EMAIL);
  await page.getByLabel('input-senha').fill(RELATIVE_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Maria Testadora')).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('app.fonte — home web', () => {
  test('home mostra dados do acolhido e da casa após login', async ({
    page,
  }) => {
    await loginAsRelative(page);

    // Cartões da home renderizados a partir do RelativeMe (seed-test).
    await expect(page.getByText('João Testador')).toBeVisible();
    await expect(page.getByText('Casa Teste')).toBeVisible();
    await expect(page.getByText('Rua das Flores, 123')).toBeVisible();
  });

  test('logout retorna à tela de login', async ({ page }) => {
    await loginAsRelative(page);

    await page.getByLabel('Sair').click();
    await expect(page.getByText('Portal do familiar')).toBeVisible({
      timeout: 15_000,
    });
  });
});
