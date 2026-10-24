import { test, expect, type Page } from '@playwright/test';

// Story 221 — cards Filhos e Servos do dashboard. Online os dois mostram a
// contagem e levam às listas; com a casa aquecida, o app reaberto sem rede
// mostra os mesmos números (store local dos filhos + `house-staff` no blob) e o
// toque continua abrindo as listas a partir do cache.
//
// Somente leitura: nada é gravado, o seed não muda. Exige a API de teste no ar
// (porta 3001) e o seed `operator@fonte.com` (Casa Teste).

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

function card(page: Page, testId: 'stat-card-residents' | 'stat-card-staff') {
  return page.getByTestId(testId).filter({ visible: true }).first();
}

/** Número exibido no card (o texto é "N\nRótulo"). */
async function readCount(page: Page, testId: 'stat-card-residents' | 'stat-card-staff') {
  await expect(card(page, testId)).toContainText(/\d+/, { timeout: 15_000 });
  const text = await card(page, testId).innerText();
  const match = text.match(/\d+/);
  expect(match).toBeTruthy();
  return match![0];
}

async function waitForWarmCache(page: Page) {
  await page.waitForFunction(
    () => {
      const keys = Object.keys(window.localStorage);
      const blobKey = keys.find((k) => k.includes('ops-fonte-query-cache'));
      const blob = blobKey ? (window.localStorage.getItem(blobKey) ?? '') : '';
      const hasResidents = keys.some((k) => k.includes('ops-fonte-resident-store:residents:'));
      return hasResidents && blob.includes('house-staff') && blob.includes('Coordenador Teste');
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe('ops.fonte — cards Filhos e Servos (story 221)', () => {
  test('online: os cards mostram as contagens e abrem as listas', async ({ page }) => {
    await loginAsOperator(page);

    await expect(page.getByText('Servos na casa', { exact: true })).toBeVisible();
    await expect(page.getByText('Ocorrências hoje', { exact: true })).toHaveCount(0);
    // Pelo menos o operador e o coordenador do seed.
    expect(Number(await readCount(page, 'stat-card-staff'))).toBeGreaterThanOrEqual(2);

    await card(page, 'stat-card-residents').click();
    await expect(page).toHaveURL(/\/residents/, { timeout: 15_000 });

    await page.goBack();
    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 15_000 });
    await card(page, 'stat-card-staff').click();
    await expect(page).toHaveURL(/\/staff/, { timeout: 15_000 });
    await expect(page.getByText('Coordenador Teste')).toBeVisible({ timeout: 15_000 });
  });

  test('sem rede: os números vêm do cache e o toque abre as listas', async ({ page }) => {
    await loginAsOperator(page);
    await waitForWarmCache(page);
    const residentsOnline = await readCount(page, 'stat-card-residents');
    const staffOnline = await readCount(page, 'stat-card-staff');

    // Mesmo truque do `offline.spec.ts`: o export web não tem service worker,
    // então "abrir sem rede" = API bloqueada + `navigator.onLine = false`.
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
    });
    await page.reload();

    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
    await expect(card(page, 'stat-card-residents')).toContainText(residentsOnline);
    await expect(card(page, 'stat-card-staff')).toContainText(staffOnline);

    await card(page, 'stat-card-staff').click();
    await expect(page).toHaveURL(/\/staff/, { timeout: 15_000 });
    await expect(page.getByText('Coordenador Teste')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Erro ao carregar dados.')).toHaveCount(0);

    await page.goBack();
    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 15_000 });
    await card(page, 'stat-card-residents').click();
    await expect(page).toHaveURL(/\/residents/, { timeout: 15_000 });
    await expect(page.getByText('Erro ao carregar dados.')).toHaveCount(0);
  });
});
