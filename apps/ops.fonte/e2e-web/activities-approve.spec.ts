import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web da story 220: o coordenador da casa aprova a solicitação e atribui o
// responsável pelo ops.
//   1. Sem sinal: "Aprovar solicitação" e o toque no responsável ficam
//      desabilitados com o aviso, e nada sai do aparelho (sem outbox — decisão 9).
//   2. Com sinal: aprovar sem responsável abre o seletor; escolher o servo já
//      aprova, o card vai para "A fazer" e o Histórico mostra a atribuição.
//
// Exige a API de teste no ar (porta 3001) com o seed (`coord@fonte.com` é
// COORDINATOR da "Casa Teste"; `operator@fonte.com` é o servo "Operador Teste").
// A solicitação é fixture própria, criada via API pelo servo e removida no fim
// pelo admin (story 182): o seed não é mutado.

const API_BASE_URL = 'http://localhost:3001/api/v1';
const COORDINATOR = { email: 'coord@fonte.com', password: 'coord123' };
const OPERATOR = { email: 'operator@fonte.com', password: 'operator123' };
const SERVANT_NAME = 'Operador Teste';

let api: APIRequestContext;
const createdIds: string[] = [];

async function token(user: { email: string; password: string }): Promise<string> {
  const login = await api.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: user.email, password: user.password },
  });
  expect(login.ok(), `login de ${user.email} na API de teste`).toBeTruthy();
  return (await login.json()).accessToken;
}

/** Solicitação nova, sem responsável, criada pelo servo da casa. */
async function createRequest(title: string): Promise<string> {
  const headers = { Authorization: `Bearer ${await token(OPERATOR)}` };
  const me = await api.get(`${API_BASE_URL}/staff/me`, { headers });
  const { houseId } = await me.json();
  const created = await api.post(`${API_BASE_URL}/activities`, {
    headers,
    data: { title, houseId },
  });
  expect(created.ok(), 'fixture da atividade').toBeTruthy();
  const id = (await created.json()).id as string;
  createdIds.push(id);
  const sent = await api.patch(`${API_BASE_URL}/activities/${id}/status`, {
    headers,
    data: { status: 'REQUESTED' },
  });
  expect(sent.ok(), 'fixture enviada como solicitação').toBeTruthy();
  return id;
}

test.beforeAll(async () => {
  api = await request.newContext();
});

test.afterAll(async () => {
  if (createdIds.length) {
    const headers = { Authorization: `Bearer ${await token({ email: 'admin@fonte.com', password: 'admin123' })}` };
    for (const id of createdIds) {
      const deleted = await api.delete(`${API_BASE_URL}/activities/${id}`, { headers });
      expect([200, 204, 404]).toContain(deleted.status());
    }
  }
  await api?.dispose();
});

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(COORDINATOR.email);
  await page.getByLabel('input-senha').fill(COORDINATOR.password);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

/** O expo-router mantém a tela anterior montada: tudo filtrado por visível. */
function visible(page: Page, text: string | RegExp) {
  return typeof text === 'string'
    ? page.getByText(text, { exact: true }).filter({ visible: true }).first()
    : page.getByText(text).filter({ visible: true }).first();
}

async function openRequests(page: Page, activityId: string) {
  await visible(page, 'Atividades').click();
  await page.getByTestId('activity-tab-REQUESTED').click();
  const card = page
    .getByTestId('activity-column-REQUESTED')
    .getByTestId(`activity-card-${activityId}`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test.describe('ops.fonte — aprovar solicitação e responsável (story 220)', () => {
  test.setTimeout(120_000);

  test('sem sinal: aprovar e trocar responsável ficam desabilitados com aviso', async ({
    page,
    context,
  }) => {
    const id = await createRequest(`Aprovar offline ${Date.now()}`);
    const writes: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes(`/activities/${id}`)) writes.push(req.url());
    });

    await login(page);
    const card = await openRequests(page, id);

    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });

    await expect(card.getByText('Precisa de conexão para mudar a situação.')).toBeVisible();
    await expect(card.getByText('Precisa de conexão para trocar o responsável.')).toBeVisible();

    await card.getByText('Aprovar solicitação', { exact: true }).click({ force: true });
    await card.getByLabel('Definir responsável').click({ force: true });

    // Nada de seletor, nada na fila, nada enviado.
    await expect(page.getByTestId('select-responsible-modal').filter({ visible: true })).toHaveCount(0);
    await expect(page.getByTestId('sync-queue-badge').filter({ visible: true })).toHaveCount(0);
    expect(writes).toEqual([]);

    await context.setOffline(false);
  });

  test('com sinal: aprovar sem responsável abre o seletor e registra a atribuição', async ({
    page,
  }) => {
    const id = await createRequest(`Aprovar online ${Date.now()}`);

    await login(page);
    const card = await openRequests(page, id);

    await card.getByText('Aprovar solicitação', { exact: true }).click();
    const modal = page.getByTestId('select-responsible-modal').filter({ visible: true });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByLabel(`Responsável ${SERVANT_NAME}`).click();
    await expect(modal).toHaveCount(0, { timeout: 15_000 });

    // O card foi para "A fazer" já com o responsável.
    const todoCard = page
      .getByTestId('activity-column-TODO')
      .getByTestId(`activity-card-${id}`);
    await expect(todoCard).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('activity-tab-TODO').click();
    await expect(todoCard.getByText(SERVANT_NAME)).toBeVisible();

    // Histórico do detalhe mostra a atribuição feita na aprovação.
    await todoCard.getByText(/Aprovar online/).click();
    await visible(page, 'Histórico').click();
    await expect(visible(page, new RegExp(`atribuiu a ${SERVANT_NAME}`))).toBeVisible({
      timeout: 15_000,
    });
    await expect(visible(page, /moveu de Solicitações para A fazer/)).toBeVisible();
  });
});
