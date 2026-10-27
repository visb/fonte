import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { todayInSaoPaulo } from '@fonte/types';

const BASE = 'http://localhost:3001/api/v1';
const suffix = Date.now();
const residentName = `Cadastro contribuição ${suffix}`;
const itemName = `Arroz inline ${suffix}`;
let api: APIRequestContext;
let headers: Record<string, string>;
let operatorHeaders: Record<string, string>;
let residentId: string, houseId: string, receivableId: string;
const itemIds: string[] = [];
const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
test.beforeAll(async () => {
  api = await request.newContext();
  const auth = await api.post(`${BASE}/auth/login`, { data: { identifier: 'admin@fonte.com', password: 'admin123' } });
  headers = { Authorization: `Bearer ${(await auth.json()).accessToken}` };
  const operator = await api.post(`${BASE}/auth/login`, { data: { identifier: 'operator@fonte.com', password: 'operator123' } });
  operatorHeaders = { Authorization: `Bearer ${(await operator.json()).accessToken}` };
  houseId = (await (await api.get(`${BASE}/staff/me`, { headers: operatorHeaders })).json()).houseId;
  const resident = await api.post(`${BASE}/residents`, { headers, data: { name: residentName, houseId, entryDate: todayInSaoPaulo(), familyInvestment: 'PAYMENT_700', contributionDueDay: 10 } });
  expect(resident.ok()).toBeTruthy(); residentId = (await resident.json()).id;
  receivableId = (await (await api.get(`${BASE}/residents/${residentId}/receivables`, { headers })).json())[0].id;
});
test.afterAll(async () => {
  if (residentId && receivableId) {
    const list = await api.get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers });
    if (list.ok()) for (const row of await list.json()) await api.delete(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions/${row.id}`, { headers });
  }
  for (const id of itemIds) await api.delete(`${BASE}/storerooms/items/${id}`, { headers });
  if (residentId) await api.delete(`${BASE}/residents/${residentId}`, { headers });
  await api?.dispose();
});
async function open(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill('operator@fonte.com');
  await page.getByLabel('input-senha').fill('operator123');
  await visible(page, 'Entrar').click();
  await expect(visible(page, 'Bem-vindo,')).toBeVisible({ timeout: 30_000 });
  await visible(page, 'Menu').click(); await visible(page, 'Contribuições').click();
  await page.getByRole('button', { name: 'Nova contribuição', exact: true }).click();
  await page.getByLabel('Buscar filho').filter({ visible: true }).fill(residentName);
  await page.getByRole('button', { name: residentName, exact: true }).click();
  await expect(page.getByPlaceholder('Buscar produto...').filter({ visible: true })).toBeVisible();
  await expect(page.getByPlaceholder('Carregando catálogo...')).toHaveCount(0);
}
async function create(page: Page, name: string) {
  await page.getByPlaceholder('Buscar produto...').filter({ visible: true }).first().fill(name);
  await visible(page, `Cadastrar «${name}»`).click();
  await expect(page.getByLabel('Nome do produto').filter({ visible: true })).toHaveValue(name);
  await page.getByLabel('Unidade do produto').filter({ visible: true }).fill('kg');
  await visible(page, 'Cadastrar produto').click();
  await expect(page.getByLabel('Produto selecionado').filter({ visible: true }).first()).toContainText(name);
}
test.describe('inline catalog creation', () => {
  test.setTimeout(180_000);
  test('offline creation + declaration survive reload and replay exactly once with real id', async ({ page, context }) => {
    await open(page);
    const sent: { url: string; data: any; key: string }[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && (req.url().endsWith('/storerooms/items') || req.url().endsWith('/product-contributions')))
        sent.push({ url: req.url(), data: req.postDataJSON(), key: req.headers()['idempotency-key'] });
    });
    page.on('response', async (res) => {
      if (res.request().method() === 'POST' && res.url().endsWith('/storerooms/items') && res.ok()) itemIds.push((await res.json()).id);
    });
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await create(page, itemName);
    // Optimistic catalog is immediately available to another line.
    await visible(page, '+ Adicionar produto').click();
    await page.getByPlaceholder('Buscar produto...').filter({ visible: true }).fill(itemName);
    await expect(page.getByLabel(`Selecionar ${itemName}`, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByLabel('Remover produto', { exact: true }).filter({ visible: true }).last().click();
    await page.getByLabel('Quantidade', { exact: true }).filter({ visible: true }).fill('2');
    await visible(page, 'Declarar contribuição').click();
    await page.waitForFunction(() => Object.values(localStorage).some((value) => value.includes('local:') && value.includes('productContributions') && value.includes('createItem')));
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    await context.setOffline(false); await page.reload();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await visible(page, 'Menu').click(); await visible(page, 'Pendências de envio').click();
    await expect(visible(page, 'Novo item da dispensa')).toBeVisible();
    await expect(visible(page, 'Contribuição em produtos')).toBeVisible();
    sent.length = 0;
    await page.unroute('**/api/v1/**');
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
    await expect.poll(async () => (await (await api.get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers })).json()).length, { timeout: 45_000 }).toBe(1);
    expect(sent.map((entry) => entry.url.endsWith('/storerooms/items') ? 'item' : 'declaration')).toEqual(['item', 'declaration']);
    expect(JSON.stringify(sent)).not.toContain('local:');
    const lines = await (await api.get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers })).json();
    expect(lines[0].pendingDetailing).toBe(false);
    expect(lines[0].inventoryItemId).toBe(itemIds[0]);
    // Repeat the actual captured requests; idempotency must preserve one item and one stock entry.
    for (const entry of sent) expect((await api.post(entry.url, { headers: { ...operatorHeaders, 'Idempotency-Key': entry.key }, data: entry.data })).ok()).toBeTruthy();
    const items = await (await api.get(`${BASE}/storerooms/items?houseId=${houseId}`, { headers })).json();
    expect(items.filter((item: any) => item.name === itemName)).toHaveLength(1);
    expect(Number(items.find((item: any) => item.id === itemIds[0]).currentQuantity)).toBe(2);
  });
  test('rejected creation puts named dependency in sync and never sends local id', async ({ page, context }) => {
    await open(page);
    const name = `Recusado ${suffix}`;
    let declarationRequests = 0;
    let rejectCreation = false;
    await page.route('**/storerooms/items', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (!rejectCreation) return route.abort('internetdisconnected');
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Produto duplicado' }) });
    });
    page.on('request', (req) => { if (req.method() === 'POST' && req.url().endsWith('/product-contributions')) declarationRequests++; });
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await create(page, name);
    await page.getByLabel('Quantidade', { exact: true }).filter({ visible: true }).fill('1');
    await visible(page, 'Declarar contribuição').click();
    await expect(page).toHaveURL(/\/contributions(?:\?|$)/);
    await expect(page.getByTestId(`contribution-${residentId}`).filter({ visible: true }).getByText('Aguardando envio', { exact: true })).toBeVisible();
    rejectCreation = true;
    await context.setOffline(false);
    await expect.poll(() => page.evaluate((product) => Object.values(localStorage).some((value) =>
      value.includes(`O produto «${product}» ainda não foi enviado`)), name), { timeout: 45_000 }).toBe(true);
    await page.goto('/sync');
    await expect(page.getByText(`O produto «${name}» ainda não foi enviado. Reenvie o cadastro do produto primeiro.`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 45_000 });
    expect(declarationRequests).toBe(0);
  });
});
