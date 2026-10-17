import { test, expect, type Page } from '@playwright/test';

// Story 204 — lista *Servos* do ops funciona offline. Com a casa aquecida
// online (prefetch do login), o app reabre sem rede e a tela lista os servos
// vindos do cache persistido (`house-staff` na allowlist), sem erro de rede.
//
// Somente leitura: nada é gravado, o seed não muda. Exige a API de teste no ar
// (porta 3001) e o seed `operator@fonte.com` (Casa Teste, com o coordenador).

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

async function waitForPersistedStaff(page: Page) {
  await page.waitForFunction(
    () => {
      const key = Object.keys(window.localStorage).find((k) =>
        k.includes('ops-fonte-query-cache'),
      );
      const blob = key ? (window.localStorage.getItem(key) ?? '') : '';
      return blob.includes('house-staff') && blob.includes('Coordenador Teste');
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe('ops.fonte — Servos (story 204)', () => {
  test('menu → Servos lista os servos da casa online', async ({ page }) => {
    await loginAsOperator(page);

    await page.getByText('Menu', { exact: true }).last().click();
    await page.getByText('Servos', { exact: true }).click();

    await expect(page.getByText('Coordenador Teste')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Coordenador', { exact: true }).first()).toBeVisible();
    // O próprio operador aparece marcado e sem botão de WhatsApp.
    await expect(page.getByText('(você)')).toBeVisible();
    await expect(page.getByLabel('WhatsApp de Operador Teste')).toHaveCount(0);
    await expect(page.getByLabel('WhatsApp de Coordenador Teste')).toBeVisible();
  });

  test('com a casa aquecida, reabrir sem rede mostra a lista do cache', async ({ page }) => {
    await loginAsOperator(page);
    // O aquecimento da casa no login põe a lista no blob persistido.
    await waitForPersistedStaff(page);

    // Mesmo truque do `offline.spec.ts`: bloquear a API e forçar
    // `navigator.onLine = false` antes do boot (o export web não tem service
    // worker, então `context.setOffline` derrubaria o próprio documento).
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
    });

    await page.goto('/staff');

    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Coordenador Teste')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Operador Teste')).toBeVisible();
    await expect(page.getByText('Erro ao carregar dados.')).toHaveCount(0);
  });
});
