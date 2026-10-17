import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web das atividades em colunas (story 208): abas por status no topo, uma
// coluna por vez. Mudar o status de um card não troca de aba; o card sai da
// coluna e os contadores das duas abas se atualizam.
//
// Exige a API de teste no ar (porta 3001) com o seed (`operator@fonte.com`). A
// atividade é fixture própria (criada via API, removida no fim — story 182): o
// seed não tem atividades e não é mutado.

const API_BASE_URL = 'http://localhost:3001/api/v1';
const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

const TITLE = `Atividade abas ${Date.now()}`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let activityId: string;

test.beforeAll(async () => {
  api = await request.newContext();
  const login = await api.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: OPERATOR_EMAIL, password: OPERATOR_PASSWORD },
  });
  expect(login.ok(), 'login do operador na API de teste').toBeTruthy();
  authHeaders = { Authorization: `Bearer ${(await login.json()).accessToken}` };

  const me = await api.get(`${API_BASE_URL}/staff/me`, { headers: authHeaders });
  const { houseId } = await me.json();

  const created = await api.post(`${API_BASE_URL}/activities`, {
    headers: authHeaders,
    data: { title: TITLE, status: 'DRAFT', houseId },
  });
  expect(created.ok(), 'fixture da atividade').toBeTruthy();
  activityId = (await created.json()).id;
});

test.afterAll(async () => {
  if (activityId) {
    // Só o próprio rascunho pode ser excluído pelo criador: devolve antes. As
    // duas chamadas toleram falha (a atividade pode já estar em DRAFT).
    await api.patch(`${API_BASE_URL}/activities/${activityId}/status`, {
      headers: authHeaders,
      data: { status: 'DRAFT' },
    });
    await api.delete(`${API_BASE_URL}/activities/${activityId}`, { headers: authHeaders });
  }
  await api?.dispose();
});

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

async function tabCount(page: Page, status: string): Promise<number> {
  return Number(await page.getByTestId(`activity-tab-count-${status}`).innerText());
}

test.describe('ops.fonte — atividades em colunas (story 208)', () => {
  test('abas por status; mudar o status mantém a aba e atualiza os contadores', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await page.getByText('Atividades', { exact: true }).filter({ visible: true }).first().click();

    // As 6 abas aparecem, mesmo vazias.
    for (const status of ['DRAFT', 'REQUESTED', 'TODO', 'DOING', 'BLOCKED', 'DONE']) {
      await expect(page.getByTestId(`activity-tab-${status}`)).toBeVisible({ timeout: 30_000 });
    }

    const card = page.getByTestId(`activity-card-${activityId}`);
    const draftTab = page.getByTestId('activity-tab-DRAFT');

    // Rascunhos é a primeira coluna e tem a fixture: abre nela.
    await expect(draftTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('activity-column-DRAFT').getByTestId(`activity-card-${activityId}`)).toBeInViewport();

    const draftsBefore = await tabCount(page, 'DRAFT');
    const requestedBefore = await tabCount(page, 'REQUESTED');

    await card.getByText('Enviar', { exact: true }).click();

    // O card foi para Solicitações, mas a aba ativa continua Rascunhos.
    await expect(
      page.getByTestId('activity-column-REQUESTED').getByTestId(`activity-card-${activityId}`),
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(draftTab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => tabCount(page, 'DRAFT')).toBe(draftsBefore - 1);
    await expect.poll(() => tabCount(page, 'REQUESTED')).toBe(requestedBefore + 1);

    // Tocar na aba leva à coluna dela.
    await page.getByTestId('activity-tab-REQUESTED').click();
    await expect(page.getByTestId('activity-tab-REQUESTED')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByTestId('activity-column-REQUESTED').getByTestId(`activity-card-${activityId}`),
    ).toBeInViewport();
  });
});
