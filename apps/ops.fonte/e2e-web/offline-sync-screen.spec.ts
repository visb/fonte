import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web da tela de pendências (story 170): o operador precisa **ver** o que
// não subiu. Dois ciclos:
//
//   1. sem sinal → lançamento entra na fila → badge da home conta 1 → a tela
//      mostra o item em "Aguardando envio" → rede volta → some e o badge zera;
//   2. servidor recusa (422) → item aparece em "Não enviadas" com a mensagem do
//      backend → descartar com confirmação → lista esvazia e o badge zera.
//
// Mora aqui porque o Maestro não controla rede e o NetInfo em web lê
// `navigator.onLine`, que o `context.setOffline` mexe.
//
// Exige a API de teste no ar (porta 3001) com o seed (`operator@fonte.com`). O
// item do almoxarifado é criado por fixture via API — o seed de teste não traz
// itens de estoque.
//
// "Almoxarifado" na UI é o módulo `supply-room` (o `storeroom` é a "Dispensa").

const API_BASE_URL = 'http://localhost:3001/api/v1';
const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

const MOVEMENTS_PATH = /\/supply-room\/movements(\?|$)/;
const REJECTION_MESSAGE = 'Quantidade indisponível em estoque.';

const ITEM_NAME = `Sync ${Date.now()}`;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext();

  const login = await api.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: OPERATOR_EMAIL, password: OPERATOR_PASSWORD },
  });
  expect(login.ok(), 'login do operador na API de teste').toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${(await login.json()).accessToken}` };

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

/** O expo-router mantém a tela anterior montada: tudo filtrado por visível. */
function visible(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function badge(page: Page) {
  return page.getByTestId('sync-queue-badge').filter({ visible: true });
}

/**
 * Abre a lista do almoxarifado **com rede**: é o que enche o cache persistido
 * (story 168). Sem essa passagem, a tela abre vazia offline e não há item para
 * lançar — o cache é pré-requisito do lançamento em campo, não do teste.
 */
async function openSupplyRoom(page: Page) {
  // Almoxarifado escondido do menu por ora (vai voltar): entra pela rota.
  await page.goto('/supply-room');
  await expect(visible(page, ITEM_NAME)).toBeVisible({ timeout: 30_000 });
}

/** Lança uma entrada de 2 no item da fixture, já na lista do almoxarifado. */
async function registerMovement(page: Page) {
  await page.getByLabel('Movimentar item').click();
  await page.getByPlaceholder('Buscar item...').filter({ visible: true }).fill(ITEM_NAME);
  await visible(page, ITEM_NAME).click();
  await page.getByPlaceholder('0').filter({ visible: true }).fill('2');
  await page.getByText('Registrar entrada').filter({ visible: true }).click();
}

async function goHome(page: Page) {
  await page.getByText('Início', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 15_000 });
}

test.describe('ops.fonte — tela de pendências de sincronização', () => {
  // Ciclo inteiro (login, offline, fila, tela e volta da rede) não cabe nos 60s
  // padrão do playwright.config.
  test.setTimeout(180_000);

  test('lançamento feito sem rede aparece em "Aguardando envio" e some quando a rede volta', async ({
    page,
    context,
  }) => {
    await loginAsOperator(page);
    // Sem fila, o badge não polui a home.
    await expect(badge(page)).toHaveCount(0);
    await openSupplyRoom(page);

    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
    await registerMovement(page);
    await expect(page.getByText(/Será enviada quando a conexão voltar/)).toBeVisible({
      timeout: 15_000,
    });

    await goHome(page);
    await expect(badge(page)).toHaveCount(1, { timeout: 15_000 });
    await expect(visible(page, '1 lançamento por sincronizar')).toBeVisible();

    await badge(page).click();

    await expect(visible(page, 'Aguardando envio')).toBeVisible({ timeout: 15_000 });
    await expect(visible(page, 'Movimentação do almoxarifado')).toBeVisible();
    await expect(visible(page, 'Entrada de 2')).toBeVisible();
    // Seção sem item não aparece.
    await expect(page.getByText('Não enviadas', { exact: true })).toHaveCount(0);
    // O aviso que a 169 deixou em aberto: sair do app apaga a fila.
    await expect(page.getByTestId('sync-logout-notice').filter({ visible: true })).toHaveCount(1);

    await context.setOffline(false);

    await expect(page.getByText(/Nada pendente/).filter({ visible: true })).toHaveCount(1, {
      timeout: 30_000,
    });
    await goHome(page);
    await expect(badge(page)).toHaveCount(0);
  });

  test('lançamento recusado pelo servidor fica visível com o erro e só sai por descarte confirmado', async ({
    page,
  }) => {
    await loginAsOperator(page);

    // Rejeição de regra de negócio: 4xx não se resolve repetindo, o item para e
    // vai para a dead-letter com a mensagem do backend.
    await page.route(MOVEMENTS_PATH, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 422, message: REJECTION_MESSAGE }),
      });
    });

    await openSupplyRoom(page);
    await registerMovement(page);

    await goHome(page);
    await expect(badge(page)).toHaveCount(1, { timeout: 30_000 });
    await badge(page).click();

    await expect(visible(page, 'Não enviadas')).toBeVisible({ timeout: 15_000 });
    await expect(visible(page, 'Movimentação do almoxarifado')).toBeVisible();
    await expect(visible(page, REJECTION_MESSAGE)).toBeVisible();

    // Descarte é sempre ação explícita e confirmada — nada some em silêncio.
    await page.getByLabel('Descartar lançamento').filter({ visible: true }).first().click();
    await expect(visible(page, 'Descartar lançamento?')).toBeVisible();
    await expect(visible(page, REJECTION_MESSAGE)).toBeVisible();

    await page.getByLabel('Confirmar descarte').filter({ visible: true }).click();

    await expect(page.getByText(/Nada pendente/).filter({ visible: true })).toHaveCount(1, {
      timeout: 15_000,
    });
    await goHome(page);
    await expect(badge(page)).toHaveCount(0);
  });
});
