import { test, expect, type Page } from '@playwright/test';

// e2e web do fluxo central: após login, o dashboard do operador carrega os
// dados da casa (stats + ações rápidas). Não cobre fluxos que dependem de API
// nativa (foto/câmera, push, áudio) — esses ficam só no Maestro (e2e/*.yaml).
//
// Exige a API de teste no ar (porta 3001), seed `operator@fonte.com`.

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

test.describe('ops.fonte — dashboard web', () => {
  test('dashboard carrega ações rápidas após login', async ({ page }) => {
    await loginAsOperator(page);

    // Ações rápidas renderizadas a partir da casa do operador.
    await expect(page.getByText('Ministérios')).toBeVisible();
    await expect(page.getByText('Almoxarifado')).toBeVisible();
    await expect(page.getByText('Atividades')).toBeVisible();
  });

  test('logout retorna à tela de login', async ({ page }) => {
    await loginAsOperator(page);

    await page.getByText('Sair', { exact: true }).click();
    await expect(page.getByText('ops.fonte')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plataforma operacional')).toBeVisible();
  });
});
