import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { todayInSaoPaulo } from '@fonte/types';

const BASE = 'http://localhost:3001/api/v1';
const name = `Produtos offline ${Date.now()}`;
const itemName = `Arroz produtos ${Date.now()}`;
let api: APIRequestContext;
let headers: Record<string, string>;
let residentId: string, houseId: string, itemId: string, receivableId: string;
const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
test.beforeAll(async () => {
  api = await request.newContext();
  const auth = await api.post(`${BASE}/auth/login`, { data: { identifier: 'admin@fonte.com', password: 'admin123' } });
  expect(auth.ok()).toBeTruthy();
  headers = { Authorization: `Bearer ${(await auth.json()).accessToken}` };
  const operator = await api.post(`${BASE}/auth/login`, { data: { identifier: 'operator@fonte.com', password: 'operator123' } });
  const me = await api.get(`${BASE}/staff/me`, { headers: { Authorization: `Bearer ${(await operator.json()).accessToken}` } });
  houseId = (await me.json()).houseId;
  const resident = await api.post(`${BASE}/residents`, { headers, data: { name, houseId,
    entryDate: todayInSaoPaulo(), familyInvestment: 'PAYMENT_700', contributionDueDay: 10 } });
  expect(resident.ok()).toBeTruthy(); residentId = (await resident.json()).id;
  const receivables = await api.get(`${BASE}/residents/${residentId}/receivables`, { headers });
  receivableId = (await receivables.json())[0].id;
  const item = await api.post(`${BASE}/storerooms/items`, { headers, data: { name: itemName, unit: 'kg', houseId } });
  expect(item.ok()).toBeTruthy(); itemId = (await item.json()).id;
  const contribution = await api.post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers, data: { lines: [{ description: 'Já recebido' }] } });
  expect(contribution.ok()).toBeTruthy();
});
test.afterAll(async () => {
  if (residentId && receivableId) {
    const list = await api.get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers });
    if (list.ok()) for (const row of await list.json()) await api.delete(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions/${row.id}`, { headers });
  }
  if (itemId) await api.delete(`${BASE}/storerooms/items/${itemId}`, { headers });
  if (residentId) await api.delete(`${BASE}/residents/${residentId}`, { headers });
  await api?.dispose();
});
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill('operator@fonte.com');
  await page.getByLabel('input-senha').fill('operator123');
  await visible(page, 'Entrar').click();
  await expect(visible(page, 'Bem-vindo,')).toBeVisible({ timeout: 30_000 });
  await visible(page, 'Menu').click();
  await visible(page, 'Contribuições').click();
  await expect(page.getByTestId(`contribution-${residentId}`).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
}
async function openForm(page: Page) {
  await page.getByRole('button', { name: 'Nova contribuição', exact: true }).click();
  await page.getByLabel('Buscar filho').filter({ visible: true }).fill(name);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByPlaceholder('Buscar produto...').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
}
test.describe('contributions offline', () => {
  test.setTimeout(180_000);
  test('online declaration from menu returns to the monthly queue', async ({ page }) => {
    await login(page);
    await openForm(page);
    await page.getByPlaceholder('Buscar produto...').filter({ visible: true }).fill(itemName);
    await page.getByLabel(`Selecionar ${itemName}`, { exact: true }).click();
    await page.getByLabel('Quantidade', { exact: true }).filter({ visible: true }).fill('1');
    await visible(page, '+ Adicionar produto').click();
    await page.getByLabel('Avulso', { exact: true }).filter({ visible: true }).last().click();
    await page.getByLabel('Descrição', { exact: true }).filter({ visible: true }).fill('Cesta online 195');
    await visible(page, 'Declarar contribuição').click();
    const card = page.getByTestId(`contribution-${residentId}`).filter({ visible: true });
    await expect(card.getByText('Cesta online 195', { exact: true })).toBeVisible();
    await expect(card.getByText('Aguardando envio', { exact: true })).toHaveCount(0);
  });
  test('menu, two product modes, reload offline, replay exactly once and server rejection', async ({ page, context }) => {
    await login(page);
    await expect(visible(page, 'Já recebido')).toBeVisible();
    // First visit warms the existing catalog query; resident summary comes from house snapshot.
    await openForm(page);
    await page.getByPlaceholder('Buscar produto...').filter({ visible: true }).fill(itemName);
    await page.getByLabel(`Selecionar ${itemName}`, { exact: true }).click();
    await page.getByLabel('Quantidade', { exact: true }).filter({ visible: true }).fill('3');
    await visible(page, '+ Adicionar produto').click();
    await page.getByLabel('Avulso', { exact: true }).filter({ visible: true }).last().click();
    await page.getByLabel('Descrição', { exact: true }).filter({ visible: true }).fill('Cesta offline 195');
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await visible(page, 'Declarar contribuição').click();
    const card = () => page.getByTestId(`contribution-${residentId}`).filter({ visible: true });
    await expect(card().getByText('Aguardando envio', { exact: true })).toBeVisible();
    await expect(card().getByText('Cesta offline 195', { exact: true })).toBeVisible();
    await page.waitForFunction(() => Object.values(localStorage).some((value) => value.includes('productContributions') && value.includes('isPaused')));
    // Export Expo has no service worker: keep assets reachable but API and NetInfo offline on boot.
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    await context.setOffline(false);
    await page.reload();
    await expect(card().getByText('Aguardando envio', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(card().getByText('Cesta offline 195', { exact: true })).toBeVisible();
    await page.unroute('**/api/v1/**');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      window.dispatchEvent(new Event('online'));
    });
    await expect(card().getByText('Aguardando envio', { exact: true })).toHaveCount(0, { timeout: 45_000 });
    const list = await api.get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`, { headers });
    const lines = await list.json();
    expect(lines.filter((line: { description: string }) => line.description === 'Cesta offline 195')).toHaveLength(1);
    expect(lines.filter((line: { inventoryItemId: string; quantity: number }) => line.inventoryItemId === itemId && Number(line.quantity) === 3)).toHaveLength(1);

    // A second queued declaration is refused; confirmed lines remain visible and reason is in /sync.
    await openForm(page);
    await page.getByLabel('Avulso', { exact: true }).filter({ visible: true }).first().click();
    await page.getByLabel('Descrição', { exact: true }).filter({ visible: true }).fill('Cesta rejeitada 195');
    await context.setOffline(true);
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await visible(page, 'Declarar contribuição').click();
    await expect(card().getByText('Cesta rejeitada 195', { exact: true })).toBeVisible();
    await page.route('**/product-contributions', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Parcela indisponível para declaração' }) });
      else await route.continue();
    });
    await context.setOffline(false);
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
    await expect(card().getByText('Cesta rejeitada 195', { exact: true })).toHaveCount(0, { timeout: 45_000 });
    await expect(card().getByText('Cesta offline 195', { exact: true })).toBeVisible();
    await visible(page, 'Menu').click();
    await visible(page, 'Pendências de envio').click();
    await expect(visible(page, 'Contribuição em produtos')).toBeVisible();
    await expect(page.getByText('Parcela indisponível para declaração').filter({ visible: true }).first()).toBeVisible();
  });
});
