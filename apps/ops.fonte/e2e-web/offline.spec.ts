import { test, expect, type Page } from '@playwright/test';

// e2e web do ciclo offline (story 168). O Maestro não controla rede, então é
// aqui que mora o teste de queda de sinal: o Playwright desliga a rede do
// contexto e o NetInfo em web lê `navigator.onLine`.
//
// Exige a API de teste no ar (porta 3001), seed `operator@fonte.com`.

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

const OFFLINE_BANNER = 'offline-banner';

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

/** Texto do card de stat da home (ex.: "12\nFilhos na casa"). */
function statCard(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..');
}

async function readStat(page: Page, label: string): Promise<string> {
  const text = (await statCard(page, label).innerText()).trim();
  const value = text.replace(label, '').trim();
  expect(value).toMatch(/^\d+$/);
  return value;
}

/**
 * Lê o cache persistido (AsyncStorage em web = localStorage, com prefixo
 * próprio da lib). A gravação é throttled, então isto é usado como espera.
 */
async function readPersistedCache(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((k) => k.includes('ops-fonte-query-cache'));
    return key ? window.localStorage.getItem(key) : null;
  });
}

/** Espera a chave de fluxo de campo cair no disco (não basta o cache existir). */
async function waitForPersistedCache(page: Page, expectedQueryKey: string) {
  await page.waitForFunction(
    (needle) => {
      const key = Object.keys(window.localStorage).find((k) =>
        k.includes('ops-fonte-query-cache'),
      );
      return !!key && (window.localStorage.getItem(key) ?? '').includes(needle);
    },
    expectedQueryKey,
    { timeout: 20_000 },
  );
}

test.describe('ops.fonte — offline', () => {
  test('banner aparece ao perder o sinal e some sozinho quando ele volta', async ({
    page,
    context,
  }) => {
    await loginAsOperator(page);
    await expect(page.getByTestId(OFFLINE_BANNER)).toHaveCount(0);

    await context.setOffline(true);
    await expect(page.getByTestId(OFFLINE_BANNER)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(OFFLINE_BANNER)).toContainText('Sem conexão');

    await context.setOffline(false);
    await expect(page.getByTestId(OFFLINE_BANNER)).toHaveCount(0, { timeout: 15_000 });
  });

  test('sem rede a sessão continua de pé e a home abre com os dados cacheados', async ({
    page,
  }) => {
    await loginAsOperator(page);
    const residentsOnline = await readStat(page, 'Filhos na casa');
    await waitForPersistedCache(page, 'residents-count');

    // Restart sem sinal. `context.setOffline(true)` também derrubaria o fetch do
    // próprio documento (o export web do Expo não tem service worker), e aí o
    // app nem carregaria — então o "abrir sem rede" é emulado bloqueando a API
    // e forçando `navigator.onLine = false` antes do boot, que é exatamente o
    // que o NetInfo lê em web.
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
    });

    await page.reload();

    // Offline não é sessão expirada: o operador continua dentro do app.
    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(OFFLINE_BANNER)).toBeVisible({ timeout: 15_000 });

    // O número veio do cache persistido — sem rede não houve como buscar.
    await expect(statCard(page, 'Filhos na casa')).toContainText(residentsOnline);
    await expect(page.getByText('Almoxarifado')).toBeVisible();
  });

  test('só as query keys da allowlist vão para o disco (LGPD)', async ({ page }) => {
    await loginAsOperator(page);
    await waitForPersistedCache(page, 'residents-count');

    const persisted = await readPersistedCache(page);
    expect(persisted).toBeTruthy();

    // A home também consulta notificações; elas ficam só em memória.
    expect(persisted).not.toContain('notifications');
    expect(persisted).not.toContain('messages-');
    expect(persisted).not.toContain('wishlist');
  });
});
