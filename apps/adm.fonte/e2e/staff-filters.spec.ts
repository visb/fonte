import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, createStaff, deleteStaff, loginApi, resolveHouseId, type StaffFixture } from './helpers/api';
import { resetStaffFilters, STAFF_FILTERS_KEY } from './helpers/preferences';

// Story 223 — busca e filtros (status e casa) na lista de servos, na URL e na
// preferência `staff.filters`. Fixtures próprias (uma casa nova e dois servos
// com nome único), criadas via API e removidas no afterAll (story 182); o seed
// é só leitura. A preferência do admin de teste é limpa antes e depois.

const tag = Date.now();
let api: APIRequestContext;
let token: string;
let houseId: string;
let houseName: string;
let inHouse: StaffFixture;
let elsewhere: StaffFixture;

test.beforeAll(async () => {
  await resetStaffFilters();
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  // A casa do seed é resolvida ANTES de criar a nossa: `resolveHouseId` cai na
  // primeira casa da lista e a fixture poderia ocupar esse lugar.
  const seedHouseId = await resolveHouseId(api, token);
  houseName = `Casa E2E Servos ${tag}`;
  const house = await api.post(`${API_URL}/houses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: houseName },
  });
  expect(house.ok()).toBe(true);
  houseId = (await house.json()).id;
  inHouse = await createStaff(api, token, { name: `E2E Busca Ána ${tag}`, houseId });
  elsewhere = await createStaff(api, token, { name: `E2E Busca Outro ${tag}`, houseId: seedHouseId });
});

test.afterAll(async () => {
  await resetStaffFilters();
  for (const s of [inHouse, elsewhere]) if (s) await deleteStaff(api, token, s.id);
  if (houseId) {
    await api.delete(`${API_URL}/houses/${houseId}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  await api.dispose();
});

const searchBox = (page: Page) => page.getByRole('textbox', { name: 'Buscar servos' });
const houseSelect = (page: Page) => page.getByRole('combobox', { name: 'Casa' });
const preferenceSaved = (page: Page) =>
  page.waitForResponse(
    (res) =>
      res.url().includes(`/preferences/${STAFF_FILTERS_KEY}`) && res.request().method() === 'PUT' && res.ok(),
  );

test.describe.serial('Servos — busca e filtros na URL (story 223)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('busca filtra e grava q; casa grava house; reload e volta do detalhe mantêm', async ({ page }) => {
    await page.goto('/staff');

    // Busca sem acento casa "Ána"; o outro servo some.
    await searchBox(page).fill(`busca ana ${tag}`);
    await expect(page).toHaveURL(/[?&]q=busca/);
    await expect(page.getByText(inHouse.name)).toBeVisible();
    await expect(page.getByText(elsewhere.name)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Servos (1)' })).toBeVisible();

    // Casa: com a busca ampla, só o servo da casa escolhida aparece.
    await searchBox(page).fill(`${tag}`);
    await expect(page.getByText(elsewhere.name)).toBeVisible();
    const saved = preferenceSaved(page);
    await houseSelect(page).selectOption({ label: houseName });
    await expect(page).toHaveURL(new RegExp(`[?&]house=${houseId}`));
    await expect(page.getByText(inHouse.name)).toBeVisible();
    await expect(page.getByText(elsewhere.name)).toHaveCount(0);
    await saved;

    // Recarregar mantém busca e casa.
    await page.reload();
    await expect(searchBox(page)).toHaveValue(`${tag}`);
    await expect(houseSelect(page)).toHaveValue(houseId);
    await expect(page.getByText(inHouse.name)).toBeVisible();
    await expect(page.getByText(elsewhere.name)).toHaveCount(0);

    // Detalhe e volta: filtros intactos.
    await page.getByText(inHouse.name).click();
    await expect(page).toHaveURL(new RegExp(`/staff/${inHouse.id}`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`[?&]house=${houseId}`));
    await expect(searchBox(page)).toHaveValue(`${tag}`);
    await expect(page.getByText(inHouse.name)).toBeVisible();

    // Desligados com a mesma busca/casa: vazio filtrado.
    await page.getByRole('button', { name: 'Desligados' }).click();
    await expect(page).toHaveURL(/[?&]status=dismissed/);
    await expect(page.getByText('Nenhum servo encontrado.')).toBeVisible();
    const back = preferenceSaved(page);
    await page.getByRole('button', { name: 'Ativos' }).click();
    await expect(page).not.toHaveURL(/status=/);
    await back;
  });

  test('sair e voltar sem params: a preferência restaura a casa (sem a busca)', async ({ page }) => {
    await page.getByRole('link', { name: 'Servos' }).click();
    await expect(page).toHaveURL(new RegExp(`/staff\\?.*house=${houseId}`));
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(houseSelect(page)).toHaveValue(houseId);
    await expect(page.getByText(inHouse.name)).toBeVisible();
    await expect(page.getByText(elsewhere.name)).toHaveCount(0);
    await expect(searchBox(page)).toHaveValue('');
  });
});
