import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { SERVICE_PERIOD_MESSAGES } from '@fonte/types';
import { login } from './helpers/auth';
import { createStaff, deleteStaff, loginApi, type StaffFixture } from './helpers/api';
import { fillDate, isoToBr } from './helpers/dates';

// Story 216 — período de serviço do servo na aba Histórico. Fixture própria
// (servo criado via API, removido no afterAll — story 182); nada do seed muda.

let api: APIRequestContext;
let token: string;
let staff: StaffFixture;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  staff = await createStaff(api, token, { name: `E2E Servo Periodo ${Date.now()}` });
});

test.afterAll(async () => {
  await deleteStaff(api, token, staff.id);
  await api.dispose();
});

async function openHistory(page: Page) {
  await page.goto(`/staff/${staff.id}?tab=admissions`);
  await expect(page.getByRole('button', { name: /Adicionar período de serviço/ })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('dialog').filter({ hasText: /período de serviço/i });

async function fillPeriod(page: Page, start: string, end: string) {
  const modal = dialog(page);
  await modal.getByLabel('Casa').selectOption({ label: 'Casa Teste' });
  // Sem Tab no início: o foco cairia no fim, que abre o próprio calendário.
  await modal.locator('#service-period-start-date').fill(isoToBr(start));
  await fillDate(modal.locator('#service-period-end-date'), end);
}

test.describe.serial('Histórico — períodos de serviço (story 216)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('servo de fixture mostra a aba Histórico com o período em andamento', async ({ page }) => {
    await page.goto(`/staff/${staff.id}`);
    await page.getByRole('button', { name: 'Histórico' }).click();
    const cards = page.getByTestId('service-period-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Em andamento');
    // A casa do período é a do cadastro (a primeira casa da API, não fixa).
    await expect(cards.first()).not.toContainText('Sem casa');
  });

  test('ADMIN adiciona período antigo e ele entra na linha do tempo', async ({ page }) => {
    await openHistory(page);
    await page.getByRole('button', { name: /Adicionar período de serviço/ }).click();
    await fillPeriod(page, '2020-01-01', '2020-06-01');
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog(page)).toHaveCount(0);

    const cards = page.getByTestId('service-period-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(1)).toContainText('01/01/2020');
    await expect(cards.nth(1)).toContainText('01/06/2020');
    await expect(cards.nth(1)).toContainText('Encerrado');
  });

  test('período sobreposto mostra o erro e não salva', async ({ page }) => {
    await openHistory(page);
    await page.getByRole('button', { name: /Adicionar período de serviço/ }).click();
    await fillPeriod(page, '2020-03-01', '2020-12-01');
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(
      dialog(page).getByText(SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-01')),
    ).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('service-period-card')).toHaveCount(2);
  });
});
