import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web dos fluxos de campo offline (story 171): o motor da fila (169/170) já
// existe; aqui o que se prova é que as **telas** funcionam sem sinal.
//
//   1. Almoxarifado: cadastrar item + lançar a movimentação dele **no mesmo
//      período offline**. É o ponto mais frágil da story — o movimento
//      referencia um item que ainda não tem id do servidor (id local), e o
//      replay precisa trocar o id no envio. Sem isso o lançamento subiria
//      apontando para `local:<uuid>` e seria recusado.
//   2. Ocorrência: registrada sem sinal, aparece na lista de hoje marcada como
//      pendente e sobe **uma vez só** quando a rede volta.
//   3. Censo: evasão registrada sem sinal e confirmada pelo backend depois.
//   4. Fluxo que exige rede (mensagens): ação desabilitada com aviso, sem erro
//      de axios na tela.
//
// Mora aqui porque o Maestro não controla rede e o NetInfo em web lê
// `navigator.onLine`, que o `context.setOffline` mexe.
//
// Exige a API de teste no ar (porta 3001) com o seed. "Almoxarifado" na UI é o
// módulo `supply-room` (o `storeroom` é a "Dispensa").

const API_BASE_URL = 'http://localhost:3001/api/v1';
const OPERATOR = { email: 'operator@fonte.com', password: 'operator123' };
const COORDINATOR = { email: 'coord@fonte.com', password: 'coord123' };

const ITEM_NAME = `Item offline ${Date.now()}`;
const INCIDENT_TEXT = `Ocorrência offline ${Date.now()}`;
/** Filho criado por fixture só para a evasão — não mexe no elenco do seed. */
const CENSUS_RESIDENT = `Filho Offline ${Date.now()}`;
/** Filho da fixture do modal de detalhes (story 179): a evasão acima o tiraria da lista. */
const DETAIL_RESIDENT = `Filho Detalhe ${Date.now()}`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let houseId: string;
let censusResidentId: string;

test.beforeAll(async () => {
  // Sem `baseURL`: com caminho absoluto o Playwright descartaria o prefixo
  // `/api/v1` ao resolver a URL relativa.
  api = await request.newContext();

  const login = await api.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: COORDINATOR.email, password: COORDINATOR.password },
  });
  expect(login.ok(), 'login do coordenador na API de teste').toBeTruthy();
  authHeaders = { Authorization: `Bearer ${(await login.json()).accessToken}` };

  const me = await api.get(`${API_BASE_URL}/staff/me`, { headers: authHeaders });
  houseId = (await me.json()).houseId;

  const created = await api.post(`${API_BASE_URL}/census/residents`, {
    headers: authHeaders,
    data: {
      name: CENSUS_RESIDENT,
      houseId,
      entryDate: new Date().toISOString().slice(0, 10),
      gender: 'MALE',
    },
  });
  expect(created.ok(), 'fixture do filho da contagem').toBeTruthy();
  censusResidentId = (await created.json()).id;

  const createdForDetail = await api.post(`${API_BASE_URL}/census/residents`, {
    headers: authHeaders,
    data: {
      name: DETAIL_RESIDENT,
      houseId,
      entryDate: new Date().toISOString().slice(0, 10),
      gender: 'MALE',
    },
  });
  expect(createdForDetail.ok(), 'fixture do filho do modal de detalhes').toBeTruthy();
});

test.afterAll(async () => {
  await api?.dispose();
});

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(user.email);
  await page.getByLabel('input-senha').fill(user.password);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

/** O expo-router mantém a tela anterior montada: tudo filtrado por visível. */
function visible(page: Page, text: string | RegExp) {
  return typeof text === 'string'
    ? page.getByText(text, { exact: true }).filter({ visible: true }).first()
    : page.getByText(text).filter({ visible: true }).first();
}

function pendingBadges(page: Page) {
  return page.getByTestId('pending-sync-badge').filter({ visible: true });
}

async function goOffline(page: Page, context: { setOffline: (v: boolean) => Promise<void> }) {
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
}

test.describe('ops.fonte — fluxos de campo sem sinal', () => {
  // Ciclo inteiro (login, offline, fila, volta da rede e conferência no
  // servidor) não cabe nos 60s padrão do playwright.config.
  test.setTimeout(180_000);

  test('almoxarifado: item cadastrado e movimentado offline sobem encadeados', async ({
    page,
    context,
  }) => {
    await login(page, OPERATOR);
    // Passagem com rede: é ela que enche o cache que a tela usa offline.
    await visible(page, 'Almoxarifado').click();
    await expect(page.getByLabel('Movimentar item')).toBeVisible({ timeout: 30_000 });

    await goOffline(page, context);

    // Cadastro do item novo dentro do próprio formulário de movimentação.
    await page.getByLabel('Movimentar item').click();
    await page.getByPlaceholder('Buscar item...').filter({ visible: true }).fill(ITEM_NAME);
    await visible(page, `+ Cadastrar "${ITEM_NAME}"`).click();
    await page.getByPlaceholder('Ex: kg, L, unid., cx...').filter({ visible: true }).fill('kg');
    await visible(page, 'Limpeza').click();
    await visible(page, 'Cadastrar').click();

    // O item entrou com id local: dá para lançar a movimentação na hora.
    await page.getByPlaceholder('0').filter({ visible: true }).fill('7');
    await visible(page, 'Registrar entrada').click();
    await expect(page.getByText(/Será enviada quando a conexão voltar/)).toBeVisible({
      timeout: 15_000,
    });

    // Item novo aparece na lista marcado como pendente (não é editável ainda).
    await expect(visible(page, ITEM_NAME)).toBeVisible({ timeout: 15_000 });
    await expect(pendingBadges(page).first()).toBeVisible();

    // ── rede de volta ───────────────────────────────────────────────────────
    await context.setOffline(false);
    await expect(pendingBadges(page)).toHaveCount(0, { timeout: 60_000 });

    // Verdade do servidor: o item existe **uma vez** e a movimentação aponta
    // para ele com a quantidade lançada offline.
    await expect
      .poll(
        async () => {
          const response = await api.get(`${API_BASE_URL}/supply-room/items`, {
            headers: authHeaders,
            params: { houseId },
          });
          const items = (await response.json()) as { name: string; currentQuantity: string }[];
          return items
            .filter((item) => item.name === ITEM_NAME)
            .map((item) => Number(item.currentQuantity));
        },
        { timeout: 60_000 },
      )
      // Um único item (o cadastro não duplicou) com o saldo do movimento que
      // apontava para o id local.
      .toEqual([7]);
  });

  test('ocorrência registrada sem sinal aparece na lista e sobe uma vez só', async ({
    page,
    context,
  }) => {
    const posts: number[] = [];
    page.on('response', (response) => {
      const request_ = response.request();
      if (request_.method() === 'POST' && request_.url().includes('/incidents')) {
        posts.push(response.status());
      }
    });

    await login(page, OPERATOR);
    await goOffline(page, context);

    await visible(page, 'Nova ocorrência').click();
    await page
      .getByPlaceholder('Descreva a ocorrência com detalhes...')
      .filter({ visible: true })
      .fill(INCIDENT_TEXT);
    await visible(page, 'Registrar ocorrência').click();

    // A tela volta na hora (nada de botão girando à espera de rede) e nada saiu
    // do aparelho. O aviso em si é um `Alert` nativo, que o `react-native-web`
    // não desenha — o texto é coberto no unit da tela.
    await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 15_000 });
    expect(posts).toEqual([]);

    await context.setOffline(false);

    // Uma única ocorrência criada — replay não duplica (story 172).
    await expect.poll(() => posts, { timeout: 60_000 }).toEqual([201]);
    const response = await api.get(`${API_BASE_URL}/incidents`, {
      headers: authHeaders,
      params: { houseId },
    });
    const incidents = (await response.json()) as { description: string }[];
    expect(incidents.filter((incident) => incident.description === INCIDENT_TEXT)).toHaveLength(1);
  });

  test('censo: evasão registrada sem sinal é confirmada pelo backend depois', async ({
    page,
    context,
  }) => {
    await login(page, COORDINATOR);
    await visible(page, 'Contagem').click();
    await expect(visible(page, CENSUS_RESIDENT)).toBeVisible({ timeout: 30_000 });

    await goOffline(page, context);

    await page.getByLabel(`Remover ${CENSUS_RESIDENT}`).click();
    await visible(page, 'Evasão').click();
    await visible(page, 'Confirmar').click();

    // O modal fecha na hora, sem esperar o servidor: a regra de transição
    // continua sendo do backend, que confirma (ou recusa, indo para /sync)
    // quando a fila subir. O aviso é um `Alert` nativo, que o
    // `react-native-web` não desenha — o texto é coberto no unit da tela.
    await expect(page.getByText('Remover filho').filter({ visible: true })).toHaveCount(0, {
      timeout: 15_000,
    });

    await context.setOffline(false);

    await expect
      .poll(
        async () => {
          const response = await api.get(`${API_BASE_URL}/residents/${censusResidentId}`, {
            headers: authHeaders,
          });
          return (await response.json()).status;
        },
        { timeout: 60_000 },
      )
      .toBe('EVADED');
  });

  // Story 179: o modal existe justamente para o operador conferir "é esse o
  // João mesmo?" no pátio — onde não há sinal. Ele abre com o que a lista já
  // tem em mãos; a ficha só enriquece se estiver no aparelho.
  test('contagem: modal de detalhes abre sem sinal, sem erro de rede', async ({
    page,
    context,
  }) => {
    await login(page, COORDINATOR);
    // Passagem com rede: é ela que enche o cache que a contagem usa offline.
    await visible(page, 'Contagem').click();
    await expect(visible(page, DETAIL_RESIDENT)).toBeVisible({ timeout: 30_000 });

    await goOffline(page, context);

    await page.getByLabel(`Detalhes de ${DETAIL_RESIDENT}`).click();

    await expect(page.getByText('Detalhes do filho').filter({ visible: true })).toBeVisible({
      timeout: 15_000,
    });
    // Bloco base: nome, situação e entrada saem da própria lista da contagem.
    await expect(visible(page, DETAIL_RESIDENT)).toBeVisible();
    await expect(visible(page, 'Aguardando aprovação')).toBeVisible();
    await expect(visible(page, 'Entrada')).toBeVisible();
    await expect(visible(page, 'Ver ficha completa')).toBeVisible();

    // A ficha (`useResidentById`) falha sem sinal — e isso não pode virar erro
    // na cara do operador nem spinner bloqueante.
    await expect(page.getByText(/Network Error|Request failed|Erro ao carregar/)).toHaveCount(0);

    await context.setOffline(false);
  });

  test('mensagens: sem sinal a ação é desabilitada com aviso, sem erro na tela', async ({
    page,
    context,
  }) => {
    await login(page, OPERATOR);
    await visible(page, 'Mensagens').click();
    await visible(page, 'Filhos').click();
    // Conversa do seed: João Testador (filho) com Maria Testadora (familiar).
    await expect(visible(page, 'Maria Testadora')).toBeVisible({ timeout: 30_000 });
    await visible(page, 'Maria Testadora').click();
    await expect(
      page.getByPlaceholder('Escreva uma mensagem...').filter({ visible: true }),
    ).toBeVisible({ timeout: 15_000 });

    await goOffline(page, context);

    // Fluxo que depende de tempo real fica fora da fila (decisão 1 do epic 167).
    await expect(page.getByTestId('offline-notice').filter({ visible: true })).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(visible(page, 'Precisa de conexão para enviar mensagens.')).toBeVisible();
    // Nada de erro genérico de axios na cara do operador.
    await expect(page.getByText(/Network Error|Request failed/)).toHaveCount(0);

    await context.setOffline(false);
    await expect(page.getByTestId('offline-notice').filter({ visible: true })).toHaveCount(0, {
      timeout: 30_000,
    });
  });
});
