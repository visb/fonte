import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web da story 224: o coordenador da casa cria direto em "A fazer" pelo
// quick-add, escolhendo o responsável no seletor — **sem sinal**.
//   1. Offline: título → "Adicionar" → seletor (lista do cache offline dos
//      servos) → escolher o servo. O card aparece pendente na coluna A fazer.
//   2. Rede de volta: a fila sobe e o servidor tem a atividade em TODO com o
//      responsável escolhido.
//
// Exige a API de teste no ar (porta 3001) com o seed (`coord@fonte.com` é
// COORDINATOR da "Casa Teste"; `operator@fonte.com` é o servo "Operador Teste").
// A atividade criada é localizada pelo título (com `Date.now()`) e removida no
// fim pelo admin, por id (story 182): o seed não é mutado.

const API_BASE_URL = 'http://localhost:3001/api/v1';
const COORDINATOR = { email: 'coord@fonte.com', password: 'coord123' };
const ADMIN = { email: 'admin@fonte.com', password: 'admin123' };
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

interface ServerActivity {
  id: string;
  title: string;
  status: string;
  responsible: { name: string } | null;
}

async function findByTitle(title: string): Promise<ServerActivity | undefined> {
  const headers = { Authorization: `Bearer ${await token(COORDINATOR)}` };
  const response = await api.get(`${API_BASE_URL}/activities`, { headers });
  const items = (await response.json()) as ServerActivity[];
  return items.filter((a) => a.title === title)[0];
}

test.beforeAll(async () => {
  api = await request.newContext();
});

test.afterAll(async () => {
  if (createdIds.length) {
    const headers = { Authorization: `Bearer ${await token(ADMIN)}` };
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
function visible(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

test.describe('ops.fonte — criar atividade por coluna com responsável (story 224)', () => {
  test.setTimeout(180_000);

  test('sem sinal: quick-add em A fazer com responsável fica pendente e sobe com status e responsável', async ({
    page,
    context,
  }) => {
    const title = `A fazer offline ${Date.now()}`;

    await login(page);
    await visible(page, 'Atividades').click();
    await page.getByTestId('activity-tab-TODO').click();
    const column = page.getByTestId('activity-column-TODO');
    const input = column.getByPlaceholder('+ Nova atividade (título)');
    await expect(input).toBeVisible({ timeout: 30_000 });

    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });

    await input.fill(title);
    await column.getByLabel('Adicionar atividade').click();

    // Seletor no modo "escolher": a lista vem do cache, sem aviso de conexão.
    const modal = page.getByTestId('select-responsible-modal').filter({ visible: true });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText('Escolher responsável')).toBeVisible();
    await expect(modal.getByText(/Precisa de conexão/)).toHaveCount(0);
    await modal.getByLabel(`Responsável ${SERVANT_NAME}`).click();
    await expect(modal).toHaveCount(0, { timeout: 15_000 });

    // Card pendente na coluna A fazer, já com o nome do responsável (cache).
    const pendingCard = column.getByTestId('activity-card-pending').filter({ hasText: title });
    await expect(pendingCard).toBeVisible({ timeout: 15_000 });
    await expect(pendingCard.getByTestId('pending-sync-badge')).toBeVisible();
    await expect(pendingCard.getByText(SERVANT_NAME)).toBeVisible();
    await expect(input).toHaveValue('');

    // ── rede de volta ───────────────────────────────────────────────────────
    await context.setOffline(false);
    await expect(pendingCard).toHaveCount(0, { timeout: 60_000 });
    const syncedCard = column.locator('[data-testid^="activity-card-"]').filter({ hasText: title });
    await expect(syncedCard).toBeVisible({ timeout: 30_000 });
    await expect(syncedCard.getByText(SERVANT_NAME)).toBeVisible();

    await expect
      .poll(async () => (await findByTitle(title))?.status ?? null, { timeout: 60_000 })
      .toBe('TODO');
    const saved = (await findByTitle(title))!;
    createdIds.push(saved.id);
    expect(saved.responsible?.name).toBe(SERVANT_NAME);
  });
});
