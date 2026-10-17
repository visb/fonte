import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

// e2e web do store local dos filhos (story 175).
//
// O que se prova aqui é o pedido da story: **a lista de filhos e a ficha dela
// estão no aparelho, sem conexão e sem prazo**.
//
//   1. Reinício sem sinal: a ficha inteira (básica, acompanhamento,
//      consentimentos, anexos) abre mesmo em filho que nunca foi aberto neste
//      aparelho — quem alimenta é o snapshot da casa (story 177), não o "já
//      visitei essa tela".
//   2. Dado velho **não** é descartado: com o relógio adiantado uma semana o
//      cache em blob (`PERSIST_MAX_AGE` de 24h) morreria; o store não tem prazo
//      e a tela passa a dizer de quando o dado é ("Atualizado em ...").
//   3. Logout sem sinal purga o aparelho (mitigação LGPD que sustenta a
//      decisão de guardar a ficha por tempo indeterminado).
//
// Mora no Playwright porque o Maestro não controla rede; o driver web
// (AsyncStorage, uma chave por registro) roda a mesma bateria de contrato do
// driver SQLite no unit, então o que passa aqui vale para o nativo.
//
// Exige a API de teste no ar (porta 3001) com o seed.

const API_BASE_URL = 'http://localhost:3001/api/v1';
const COORDINATOR = { email: 'coord@fonte.com', password: 'coord123' };

/** Filho do seed — a ficha dele é a que o teste abre sem sinal. */
const RESIDENT_NAME = 'João Testador';
const FOLLOW_UP_TEXT = `Acompanhamento offline ${Date.now()}`;
const ATTACHMENT_NAME = `anexo-offline-${Date.now()}.pdf`;

/** Prefixo das chaves do driver web (`schema.ts`). */
const STORE_PREFIX = 'ops-fonte-resident-store:';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let api: APIRequestContext;
let authHeaders: Record<string, string>;
let residentId: string;

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
  const houseId = (await me.json()).houseId;

  // O próprio pacote que o app baixa: quem está aqui é quem o aparelho guarda.
  const snapshot = await api.get(`${API_BASE_URL}/houses/${houseId}/offline-snapshot`, {
    headers: authHeaders,
  });
  expect(snapshot.ok(), 'snapshot offline da casa (story 177)').toBeTruthy();
  const residents = (await snapshot.json()).residents as { id: string; name: string }[];
  const target = residents.find((resident) => resident.name === RESIDENT_NAME);
  expect(target, `filho "${RESIDENT_NAME}" do seed`).toBeTruthy();
  residentId = target!.id;

  // Acompanhamento de fixture: sem ele a aba abriria vazia e o teste não
  // distinguiria "veio do aparelho" de "não tem nada para vir".
  const followUp = await api.post(`${API_BASE_URL}/residents/${residentId}/follow-ups`, {
    headers: authHeaders,
    data: {
      date: new Date().toISOString().slice(0, 10),
      type: 'NOTE',
      description: FOLLOW_UP_TEXT,
      accessLevel: 'ALL',
    },
  });
  expect(followUp.ok(), 'fixture de acompanhamento').toBeTruthy();

  // Anexo de fixture: da story só vai para o aparelho o **metadado** (a linha da
  // lista); o binário continua exigindo conexão, e é isso que a aba prova.
  const attachment = await api.post(`${API_BASE_URL}/residents/${residentId}/attachments`, {
    headers: authHeaders,
    multipart: {
      file: {
        name: ATTACHMENT_NAME,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 anexo de teste'),
      },
    },
  });
  expect(attachment.ok(), 'fixture de anexo').toBeTruthy();
});

test.afterAll(async () => {
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

/**
 * Registros do store local no aparelho (AsyncStorage web = localStorage). A
 * chave de versão do esquema fica de fora: ela não é dado pessoal e sobrevive à
 * purga de propósito (o store continua criado, só vazio).
 */
function residentStoreKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    (prefix) =>
      Object.keys(window.localStorage).filter(
        (key) => key.includes(prefix) && !key.endsWith(`${prefix}version`),
      ),
    STORE_PREFIX,
  );
}

/** Espera um registro específico cair no store (a gravação é assíncrona). */
async function waitForStoreRecord(page: Page, needle: string) {
  await page.waitForFunction(
    ({ prefix, wanted }) =>
      Object.keys(window.localStorage).some(
        (key) => key.includes(prefix) && key.includes(wanted),
      ),
    { prefix: STORE_PREFIX, wanted: needle },
    { timeout: 30_000 },
  );
}

/**
 * "Abrir o app sem sinal". `context.setOffline(true)` derrubaria também o fetch
 * do próprio documento (o export web do Expo não tem service worker) e o app nem
 * carregaria — então o restart offline é emulado bloqueando a API e forçando
 * `navigator.onLine = false` antes do boot, que é exatamente o que o NetInfo lê
 * em web. Vale para as navegações seguintes (as rotas sobrevivem ao reload).
 */
async function restartOffline(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
  });
  await page.reload();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
}

async function openResidentsTab(page: Page) {
  await visible(page, 'Filhos').click();
  // A lista é virtualizada: buscar o alvo evita depender do tamanho do banco.
  await page.getByPlaceholder('Buscar filho...').filter({ visible: true }).fill(RESIDENT_NAME);
  await expect(visible(page, RESIDENT_NAME)).toBeVisible({ timeout: 30_000 });
}

test.describe('ops.fonte — store local dos filhos sem sinal', () => {
  // Login, aquecimento, restart offline e passeio pelas abas não cabem nos 60s
  // padrão do playwright.config.
  test.setTimeout(180_000);

  test('a ficha inteira do filho abre depois de reiniciar o app sem sinal', async ({ page }) => {
    await login(page);

    // O aquecimento é um request só (snapshot da casa) e enche o store: ficha
    // básica, acompanhamentos, consentimentos e carnê.
    await waitForStoreRecord(page, `residents:${residentId}`);
    await waitForStoreRecord(page, `resident_details:${residentId}:follow_ups`);
    await waitForStoreRecord(page, `resident_details:${residentId}:consents`);
    await waitForStoreRecord(page, 'meta:synced-at:');
    // Story 205 (decisão 9): ministérios da casa voltam a ter nome de filho e
    // moram no store de filho (purgado no logout), não no blob de 24h.
    await waitForStoreRecord(page, 'house_ministries:');

    // Financeiro no aparelho é decisão explícita da story (consequência LGPD
    // registrada em docs/lgpd/DIAGNOSTICO_LGPD.md).
    const keys = await residentStoreKeys(page);
    expect(keys.some((key) => key.endsWith(':receivables'))).toBe(true);

    await restartOffline(page);

    // Lista: veio do aparelho, e a tela diz de quando ela é.
    await openResidentsTab(page);
    await expect(page.getByTestId('last-synced-at').filter({ visible: true }).first()).toBeVisible();

    // Ficha de um filho que nunca foi aberto neste aparelho: a página só passa
    // do LoadingState quando a ficha básica existe — e ela só pode ter vindo do
    // aparelho, porque a rede está bloqueada.
    await visible(page, RESIDENT_NAME).click();
    await expect(visible(page, 'Identificação')).toBeVisible({ timeout: 30_000 });
    // Story 205: o ministério volta à ficha do filho — e abre offline.
    await expect(visible(page, 'Ministério')).toBeVisible();

    await visible(page, 'Acompanhamento').click();
    await expect(visible(page, FOLLOW_UP_TEXT)).toBeVisible({ timeout: 15_000 });

    await visible(page, 'Privacidade').click();
    await expect(visible(page, 'Uso de imagem')).toBeVisible({ timeout: 15_000 });

    // Anexos: a lista é offline, o arquivo não — e a tela diz isso em vez de
    // estourar erro de rede.
    await visible(page, 'Anexos').click();
    await expect(visible(page, ATTACHMENT_NAME)).toBeVisible({ timeout: 15_000 });
    await expect(
      visible(page, /Precisa de conexão para abrir o arquivo/),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Network Error|Request failed/)).toHaveCount(0);
  });

  test('dado velho não é descartado: a tela mostra o frescor em vez de sumir com a ficha', async ({
    page,
  }) => {
    await login(page);
    await waitForStoreRecord(page, `residents:${residentId}`);

    // Uma semana depois. Para o cache em blob isso é morte certa
    // (`PERSIST_MAX_AGE` = 24h); o store não tem prazo — é o ponto da story.
    // `setFixedTime` mexe só no relógio, não nos timers do app.
    await page.clock.setFixedTime(new Date(Date.now() + SEVEN_DAYS_MS));

    await restartOffline(page);
    await openResidentsTab(page);

    await expect(page.getByTestId('last-synced-at').filter({ visible: true }).first()).toContainText(
      'Atualizado em',
    );
    // A ficha continua abrindo — nada foi apagado por idade.
    await visible(page, RESIDENT_NAME).click();
    await expect(visible(page, 'Identificação')).toBeVisible({ timeout: 30_000 });
  });

  test('logout sem sinal purga a ficha do aparelho (LGPD)', async ({ page }) => {
    await login(page);
    await waitForStoreRecord(page, `residents:${residentId}`);
    expect((await residentStoreKeys(page)).length).toBeGreaterThan(0);

    await restartOffline(page);

    // Sair não depende de rede: a purga é local e é o que sustenta guardar a
    // ficha por tempo indeterminado. Desde a story 176 a ação mora na tab Menu.
    // O rótulo da tab é o último match: o título do header repete o texto.
    await page.getByText('Menu', { exact: true }).filter({ visible: true }).last().click();
    await visible(page, 'Sair').click();
    await expect(page.getByLabel('input-email')).toBeVisible({ timeout: 30_000 });

    await expect.poll(() => residentStoreKeys(page), { timeout: 15_000 }).toEqual([]);

    // Restart depois do logout: nada de filho sobrevive no aparelho.
    await page.reload();
    await expect(page.getByLabel('input-email')).toBeVisible({ timeout: 30_000 });
    expect(await residentStoreKeys(page)).toEqual([]);
    await expect(page.getByText(RESIDENT_NAME)).toHaveCount(0);
  });
});
