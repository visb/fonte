import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, loginApi, createResident, deleteResident, type ResidentFixture } from './helpers/api';

let api: APIRequestContext, token: string, resident: ResidentFixture, receivableId: string, itemId: string;
const itemName = `Produto declaração ${Date.now()}`;
test.beforeAll(async () => {
  api = await request.newContext(); token = await loginApi(api);
  resident = await createResident(api, token, { name: `Família produto ${Date.now()}`, status: 'ACTIVE' });
});
test.afterAll(async () => {
  const headers = { Authorization: `Bearer ${token}` };
  if (receivableId) {
    const list = await api.get(`${API_URL}/residents/${resident.id}/receivables/${receivableId}/product-contributions`, { headers });
    if (list.ok()) for (const row of await list.json()) await api.delete(`${API_URL}/residents/${resident.id}/receivables/${receivableId}/product-contributions/${row.id}`, { headers });
  }
  if (itemId) await api.delete(`${API_URL}/storerooms/items/${itemId}`, { headers });
  if (resident) await deleteResident(api, token, resident.id);
  await api?.dispose();
});
test('creates Dispensa item inside payment, preserves amount and declares stock entry', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto(`/residents/${resident.id}`);
  await page.getByRole('button', { name: 'Contribuição', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar pagamento' }).first().click();
  const payment = page.getByRole('dialog', { name: 'Registrar contribuição' });
  const amount = payment.locator('input[type="number"]').first();
  await amount.fill('321');
  await payment.getByRole('button', { name: /Adicionar produto/ }).click();
  await payment.getByLabel('Buscar produto').fill(itemName);
  await payment.getByRole('button', { name: `Cadastrar «${itemName}»` }).click();
  const create = page.getByRole('dialog', { name: 'Novo produto' });
  await expect(create.getByLabel('Nome do produto')).toHaveValue(itemName);
  await create.getByLabel('Unidade do produto').fill('pacote');
  const response = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().endsWith('/storerooms/items'));
  await create.getByRole('button', { name: 'Cadastrar produto' }).click();
  itemId = (await (await response).json()).id;
  await expect(create).not.toBeVisible();
  await expect(payment).toBeVisible();
  await expect(amount).toHaveValue('321');
  await expect(payment.getByLabel('Produto do catálogo')).toHaveValue(itemId);
  await expect(payment.getByLabel('Buscar produto')).toBeFocused();
  await payment.getByLabel('Quantidade', { exact: true }).fill('3');
  const declared = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().endsWith('/product-contributions'));
  await payment.getByRole('button', { name: 'Confirmar' }).click();
  const contribution = await declared;
  expect(contribution.ok()).toBeTruthy();
  receivableId = contribution.url().split('/receivables/')[1].split('/')[0];
  await expect(payment).not.toBeVisible();
  const items = await (await api.get(`${API_URL}/storerooms/items?houseId=${resident.houseId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(Number(items.find((item: { id: string }) => item.id === itemId).currentQuantity)).toBe(3);
  const movements = await (await api.get(`${API_URL}/storerooms/movements?itemId=${itemId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(movements).toHaveLength(1);
  expect(movements[0].type).toBe('IN');
  expect(Number(movements[0].quantity)).toBe(3);
});
