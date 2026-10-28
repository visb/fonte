import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { todayInSaoPaulo } from '@fonte/types';

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
/** Story 196: baixa pela LISTA de filhos (fora da contagem) — fixture própria. */
const LIST_RESIDENT = `Filho Lista ${Date.now()}`;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let houseId: string;
let censusResidentId: string;
let listResidentId: string;
const residentIds: string[] = [];

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
      entryDate: todayInSaoPaulo(),
      gender: 'MALE',
    },
  });
  expect(created.ok(), 'fixture do filho da contagem').toBeTruthy();
  censusResidentId = (await created.json()).id;
  residentIds.push(censusResidentId);
  expect((await api.patch(`${API_BASE_URL}/residents/${censusResidentId}`, {
    headers: authHeaders, data: { status: 'ACTIVE' },
  })).ok()).toBeTruthy();

  const createdForDetail = await api.post(`${API_BASE_URL}/census/residents`, {
    headers: authHeaders,
    data: {
      name: DETAIL_RESIDENT,
      houseId,
      entryDate: todayInSaoPaulo(),
      gender: 'MALE',
    },
  });
  expect(createdForDetail.ok(), 'fixture do filho do modal de detalhes').toBeTruthy();
  residentIds.push((await createdForDetail.json()).id);

  // Story 196: a baixa pela lista só é oferecida para filho EM ACOLHIMENTO, e
  // `POST /census/residents` cria como CENSUS_ADDED — daí a criação por
  // `POST /residents` com `status: ACTIVE`.
  const createdForList = await api.post(`${API_BASE_URL}/residents`, {
    headers: authHeaders,
    data: {
      name: LIST_RESIDENT,
      houseId,
      entryDate: todayInSaoPaulo(),
      gender: 'MALE',
      status: 'ACTIVE',
    },
  });
  expect(createdForList.ok(), 'fixture do filho da lista').toBeTruthy();
  listResidentId = (await createdForList.json()).id;
  residentIds.push(listResidentId);
});

test.afterAll(async () => {
  if (api && residentIds.length) {
    const admin = await api.post(`${API_BASE_URL}/auth/login`, {
      data: { identifier: 'admin@fonte.com', password: 'admin123' },
    });
    expect(admin.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await admin.json()).accessToken}` };
    for (const id of residentIds) {
      const deleted = await api.delete(`${API_BASE_URL}/residents/${id}`, { headers });
      expect([200, 204, 404]).toContain(deleted.status());
    }
  }
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
    // Almoxarifado escondido do menu por ora (vai voltar): entra pela rota.
    await page.goto('/supply-room');
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
    // Story 226: a data vem com hoje (fuso local) já mascarada em dd/mm/aaaa.
    const today = todayInSaoPaulo();
    const [year, month, day] = today.split('-');
    await expect(
      page.getByLabel('Data', { exact: true }).filter({ visible: true }),
    ).toHaveValue(`${day}/${month}/${year}`, { timeout: 30_000 });
    await page
      .getByPlaceholder('Descreva a ocorrência com detalhes...')
      .filter({ visible: true })
      .fill(INCIDENT_TEXT);
    // Story 229: tipo obrigatório e sem default.
    await page.getByRole('radio', { name: 'Positiva' }).filter({ visible: true }).click();
    // Story 230: categoria obrigatória, lista filtrada pelo tipo.
    await page.getByTestId('incident-category-trigger').filter({ visible: true }).click();
    await page.getByTestId('incident-category-HELPING_OTHERS').filter({ visible: true }).click();
    await expect(visible(page, 'Ajuda ao próximo')).toBeVisible();
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
    const incidents = (await response.json()) as {
      description: string;
      date: string;
      type: string;
      category: string | null;
    }[];
    const created = incidents.filter((incident) => incident.description === INCIDENT_TEXT);
    expect(created).toHaveLength(1);
    // Payload segue ISO aaaa-mm-dd (contrato e fila offline inalterados).
    expect(String(created[0].date).slice(0, 10)).toBe(today);
    // Story 229: o tipo escolhido offline chega ao servidor.
    expect(created[0].type).toBe('POSITIVE');
    // Story 230: … junto com a categoria.
    expect(created[0].category).toBe('HELPING_OTHERS');
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

  // Story 209: no pátio, sem sinal, o operador DIGITA as datas (acolhimento
  // retroativo e nascimento de 40 anos atrás) em vez de navegar no calendário.
  // O filho entra na fila e sobe com as datas exatamente como digitadas.
  test('contagem: filho adicionado sem sinal com datas digitadas sobe com as datas certas', async ({
    page,
    context,
  }) => {
    const name = `Filho Datas ${Date.now()}`;
    const created: { status: number; id?: string }[] = [];
    page.on('response', async (response) => {
      const request_ = response.request();
      if (request_.method() === 'POST' && request_.url().endsWith('/census/residents')) {
        const body = await response.json().catch(() => ({}));
        created.push({ status: response.status(), id: body?.id });
        if (body?.id) residentIds.push(body.id);
      }
    });

    await login(page, COORDINATOR);
    // Passagem com rede: é ela que enche o cache que a contagem usa offline.
    await visible(page, 'Contagem').click();
    await expect(visible(page, 'Adicionar filho')).toBeVisible({ timeout: 30_000 });

    // Story 218 (decisão 4): ENTRAR no fluxo exige rede (pergunta "já passou?").
    // O sinal cai depois, já no formulário — e o lançamento vai para a fila.
    await visible(page, 'Adicionar filho').click();
    // No react-native-web o `onShow` do Modal (que reseta o passo) só dispara
    // no fim da animação de slide (~300ms): agir antes disso seria desfeito.
    await page.waitForTimeout(800);
    await visible(page, 'Não, é a primeira vez').click();
    await expect(page.getByPlaceholder('Nome completo').filter({ visible: true })).toBeVisible();

    await goOffline(page, context);

    await page.getByPlaceholder('Nome completo').filter({ visible: true }).fill(name);
    const entryInput = page.getByLabel('Data de acolhimento', { exact: true }).filter({ visible: true });
    await entryInput.fill('');
    await entryInput.pressSequentially('01022026');
    await expect(entryInput).toHaveValue('01/02/2026');
    const birthInput = page.getByLabel('Data de nascimento', { exact: true }).filter({ visible: true });
    await birthInput.pressSequentially('05031985');
    await expect(birthInput).toHaveValue('05/03/1985');
    await visible(page, 'Adicionar').click();

    // Modal fecha na hora; nada saiu do aparelho.
    await expect(page.getByPlaceholder('Nome completo').filter({ visible: true })).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(created).toEqual([]);

    await context.setOffline(false);

    await expect.poll(() => created.map((c) => c.status), { timeout: 60_000 }).toEqual([201]);
    const id = created[0].id!;
    const response = await api.get(`${API_BASE_URL}/residents/${id}`, { headers: authHeaders });
    const resident = (await response.json()) as { name: string; entryDate: string; birthDate: string };
    expect(resident.name).toBe(name);
    expect(resident.entryDate.slice(0, 10)).toBe('2026-02-01');
    expect(resident.birthDate.slice(0, 10)).toBe('1985-03-05');
  });

  // Story 218 (decisão 4): sem sinal não dá para checar se o filho já passou
  // pela comunidade — o botão fica desabilitado com aviso, sem erro de rede.
  test('contagem: sem sinal "Adicionar filho" fica desabilitado com aviso', async ({
    page,
    context,
  }) => {
    await login(page, COORDINATOR);
    await visible(page, 'Contagem').click();
    const addButton = page.getByLabel('Adicionar filho', { exact: true }).filter({ visible: true });
    await expect(addButton).toBeEnabled({ timeout: 30_000 });

    await goOffline(page, context);

    await expect(addButton).toBeDisabled({ timeout: 15_000 });
    await expect(
      visible(
        page,
        'Sem conexão: para adicionar um filho é preciso estar online, para checar se ele já passou pela comunidade.',
      ),
    ).toBeVisible();
    await addButton.click({ force: true });
    await expect(visible(page, 'Este filho já passou pela Fonte de Misericórdia antes?')).toHaveCount(0);
    await expect(page.getByText(/Network Error|Request failed/)).toHaveCount(0);

    await context.setOffline(false);
    await expect(addButton).toBeEnabled({ timeout: 30_000 });
  });

  // Story 218: com rede, "já passou?" → busca → reacolhe sem duplicar cadastro.
  test('contagem: reacolhe filho que já passou pela comunidade', async ({ page }) => {
    const marker = Array.from({ length: 8 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join('');
    const name = `Reacolher Web ${marker}`;
    const created = await api.post(`${API_BASE_URL}/residents`, {
      headers: authHeaders,
      data: { name, houseId, gender: 'MALE', status: 'ACTIVE', entryDate: '2025-01-10' },
    });
    expect(created.ok(), 'fixture do filho a reacolher').toBeTruthy();
    const id = (await created.json()).id;
    residentIds.push(id);
    expect((await api.patch(`${API_BASE_URL}/residents/${id}`, {
      headers: authHeaders, data: { status: 'DISCHARGED', exitDate: '2025-03-01' },
    })).ok()).toBeTruthy();

    await login(page, COORDINATOR);
    await visible(page, 'Contagem').click();
    await visible(page, 'Adicionar filho').click();
    await page.waitForTimeout(800);
    await visible(page, 'Sim').click();
    await page.getByLabel('Nome ou CPF', { exact: true }).filter({ visible: true }).fill(`web ${marker}`);
    await visible(page, 'Buscar').click();
    await page.getByLabel(`Candidato ${name}`).filter({ visible: true }).click();
    await expect(visible(page, 'Reacolher filho')).toBeVisible();
    await visible(page, 'Reacolher').click();

    // Modal fecha e o filho volta para a lista da contagem, sem cadastro novo.
    await expect(page.getByText('Reacolher filho').filter({ visible: true })).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByLabel(`Detalhes de ${name}`).filter({ visible: true })).toBeVisible({
      timeout: 30_000,
    });
    const response = await api.get(`${API_BASE_URL}/residents/${id}`, { headers: authHeaders });
    const resident = (await response.json()) as { status: string; houseId: string };
    expect(resident).toMatchObject({ status: 'ACTIVE', houseId });
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

  // Story 196 — a mesma baixa, agora pela LISTA de filhos. O que se prova aqui
  // é o que o unit não alcança: sem sinal o lançamento entra na fila, SOBREVIVE
  // ao restart do app (ainda offline) e sobe uma vez só quando a rede volta.
  test('lista de filhos: baixa sem sinal sobrevive ao restart e sobe uma vez só', async ({
    page,
    context,
  }) => {
    const patches: number[] = [];
    page.on('response', (response) => {
      const request_ = response.request();
      if (request_.method() === 'PATCH' && request_.url().includes(`/residents/${listResidentId}`)) {
        patches.push(response.status());
      }
    });

    await login(page, COORDINATOR);
    // Passagem com rede: é ela que enche o cache que a lista usa offline.
    await visible(page, 'Filhos').click();
    await expect(visible(page, LIST_RESIDENT)).toBeVisible({ timeout: 30_000 });

    await goOffline(page, context);

    await page.getByLabel(`Ações de ${LIST_RESIDENT}`).click();
    await visible(page, 'Declarar saída da comunidade').click();
    await visible(page, 'Declarar alta').click();
    await visible(page, 'Confirmar').click();

    // Fecha na hora (o aviso "salvo no aparelho" é `Alert` nativo, que o
    // react-native-web não desenha — coberto no unit da tela).
    await expect(page.getByText('Declarar saída da comunidade').filter({ visible: true })).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(patches).toEqual([]);

    // Export Expo não tem service worker: liberar somente assets no restart,
    // mantendo API bloqueada e NetInfo offline antes do novo boot.
    await page.waitForFunction((id) => Object.values(localStorage).some(
      (value) => value.includes(id) && value.includes('mutations'),
    ), listResidentId);
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    });
    await visible(page, 'Início').click();
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId('sync-queue-badge').filter({ visible: true })).toHaveCount(1, {
      timeout: 30_000,
    });
    expect(patches).toEqual([]);

    await page.unroute('**/api/v1/**');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });

    await expect(page.getByTestId('sync-queue-badge').filter({ visible: true })).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect.poll(() => patches, { timeout: 60_000 }).toEqual([200]);
    await expect
      .poll(
        async () => {
          const response = await api.get(`${API_BASE_URL}/residents/${listResidentId}`, {
            headers: authHeaders,
          });
          return (await response.json()).status;
        },
        { timeout: 60_000 },
      )
      .toBe('DISCHARGED');
  });

  test('lista de filhos: baixa recusada fica em pendências com mensagem do backend', async ({ page, context }) => {
    const name = `Filho Recusado ${Date.now()}`;
    const created = await api.post(`${API_BASE_URL}/residents`, {
      headers: authHeaders,
      data: { name, houseId, gender: 'MALE', status: 'ACTIVE', entryDate: '2026-01-01' },
    });
    expect(created.ok()).toBeTruthy();
    const id = (await created.json()).id;
    residentIds.push(id);
    await login(page, COORDINATOR);
    await visible(page, 'Filhos').click();
    await expect(visible(page, name)).toBeVisible({ timeout: 30_000 });
    await goOffline(page, context);
    await page.getByLabel(`Ações de ${name}`).click();
    await visible(page, 'Declarar saída da comunidade').click();
    await visible(page, 'Declarar alta').click();
    await visible(page, 'Confirmar').click();
    // Outro operador encerrou o vínculo enquanto este aparelho estava offline.
    expect((await api.patch(`${API_BASE_URL}/residents/${id}`, {
      headers: authHeaders, data: { status: 'EVADED', exitDate: '2026-09-26' },
    })).ok()).toBeTruthy();
    await visible(page, 'Início').click();
    await context.setOffline(false);
    await page.getByTestId('sync-queue-badge').filter({ visible: true }).click();
    await expect(visible(page, 'Não enviadas')).toBeVisible({ timeout: 30_000 });
    await expect(visible(page, 'Filho já encerrado (evasão) não pode receber alta.')).toBeVisible();
    await expect(page.getByText(/Network Error|Request failed/)).toHaveCount(0);
  });

  test('mensagens: sem sinal a ação é desabilitada com aviso, sem erro na tela', async ({
    page,
    context,
  }) => {
    await login(page, OPERATOR);
    // Mensagens escondida da tab bar por ora (vai voltar): entra pela rota.
    await page.goto('/messages');
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
