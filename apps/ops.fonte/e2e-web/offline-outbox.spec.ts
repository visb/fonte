import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web da outbox (story 169): o operador lança uma movimentação de
// almoxarifado sem sinal, o lançamento aparece na hora marcado como pendente,
// nada chega ao servidor, e quando a rede volta ele é enviado — **uma vez só**.
//
// É aqui que esse ciclo mora porque o Maestro não controla rede e o NetInfo em
// web lê `navigator.onLine`, que o `context.setOffline` mexe.
//
// Exige a API de teste no ar (porta 3001) com o seed (`operator@fonte.com`). O
// item do almoxarifado é criado por fixture via API, para o teste não depender
// do estoque que o seed deixou nem sujar a contagem de outra rodada.
//
// "Almoxarifado" na UI é o módulo `supply-room` (o `storeroom` é a "Dispensa").

const API_BASE_URL = 'http://localhost:3001/api/v1';
const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

const MOVEMENTS_ENDPOINT = '/supply-room/movements';

/** Nome único por rodada: o teste cria e localiza o próprio item. */
const ITEM_NAME = `Outbox ${Date.now()}`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;

test.beforeAll(async () => {
  // Sem `baseURL`: com caminho absoluto o Playwright descartaria o prefixo
  // `/api/v1` ao resolver a URL relativa.
  api = await request.newContext();

  const login = await api.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: OPERATOR_EMAIL, password: OPERATOR_PASSWORD },
  });
  expect(login.ok(), 'login do operador na API de teste').toBeTruthy();
  authHeaders = { Authorization: `Bearer ${(await login.json()).accessToken}` };

  const me = await api.get(`${API_BASE_URL}/staff/me`, { headers: authHeaders });
  const { houseId } = await me.json();

  const created = await api.post(`${API_BASE_URL}/supply-room/items`, {
    headers: authHeaders,
    data: { name: ITEM_NAME, unit: 'kg', category: 'CLEANING', houseId },
  });
  expect(created.ok(), 'fixture do item de almoxarifado').toBeTruthy();
});

test.afterAll(async () => {
  await api?.dispose();
});

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

/**
 * O expo-router mantém a tela anterior montada (escondida) no DOM, então todo
 * texto repetido entre a lista e o formulário precisa ser filtrado por visível.
 */
function visibleItemName(page: Page) {
  return page.getByText(ITEM_NAME, { exact: true }).filter({ visible: true }).first();
}

/** Card do item na lista do almoxarifado. */
function itemCard(page: Page) {
  return visibleItemName(page).locator('..');
}

async function readStock(page: Page): Promise<number> {
  const text = await itemCard(page).innerText();
  const match = /Estoque:\s*([\d.,]+)/.exec(text);
  expect(match, `estoque não encontrado em: ${text}`).toBeTruthy();
  return Number(match![1].replace(',', '.'));
}

test.describe('ops.fonte — outbox offline', () => {
  // Ciclo inteiro (login, offline, fila, volta da rede e reload): não cabe no
  // timeout padrão de 60s do playwright.config.
  test.setTimeout(180_000);

  test('movimentação feita sem rede fica pendente e é enviada uma única vez quando a rede volta', async ({
    page,
    context,
  }) => {
    // Só conta o que **chegou** ao servidor: offline o navegador aborta a
    // tentativa, então resposta é a medida honesta de "a requisição saiu".
    const responses: number[] = [];
    page.on('response', (response) => {
      const request_ = response.request();
      if (request_.method() === 'POST' && request_.url().includes(MOVEMENTS_ENDPOINT)) {
        responses.push(response.status());
      }
    });

    await loginAsOperator(page);
    await page.getByText('Almoxarifado').click();
    await expect(itemCard(page)).toBeVisible({ timeout: 30_000 });
    const stockBefore = await readStock(page);

    // ── sem sinal ───────────────────────────────────────────────────────────
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Movimentar item').click();
    await page.getByPlaceholder('Buscar item...').filter({ visible: true }).fill(ITEM_NAME);
    await visibleItemName(page).click();
    await page.getByPlaceholder('0').filter({ visible: true }).fill('2');
    await page.getByText('Registrar entrada').filter({ visible: true }).click();

    // O lançamento aparece na hora: volta para a lista, com o estoque já
    // atualizado e o selo de pendente — mas nada chegou ao servidor.
    await expect(page.getByText(/Será enviada quando a conexão voltar/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('pending-sync-badge').filter({ visible: true })).toHaveCount(1, {
      timeout: 15_000,
    });
    expect(await readStock(page)).toBe(stockBefore + 2);
    expect(responses).toEqual([]);

    // ── rede de volta ───────────────────────────────────────────────────────
    await context.setOffline(false);

    // O selo some quando o item sai da fila (enviado de verdade).
    await expect(page.getByTestId('pending-sync-badge').filter({ visible: true })).toHaveCount(0, {
      timeout: 30_000,
    });
    // Uma única movimentação: o replay não pode duplicar lançamento de estoque
    // (BUSINESS_RULES: almoxarifado não tem estorno).
    await expect.poll(() => responses, { timeout: 30_000 }).toEqual([201]);

    // Verdade do servidor depois de recarregar do zero.
    await page.reload();
    await expect(itemCard(page)).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => readStock(page), { timeout: 30_000 }).toBe(stockBefore + 2);
  });
});
