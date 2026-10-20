import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { formatIsoDateBr, todayInSaoPaulo } from '@fonte/types';
import { login } from './helpers/auth';
import { createStaff, deleteStaff, loginApi, type StaffFixture } from './helpers/api';

// Story 217 — desligamento e reintegração de servo. Fixture própria (servo
// criado via API, removido no afterAll — story 182); nada do seed muda.

let api: APIRequestContext;
let token: string;
let staff: StaffFixture;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  staff = await createStaff(api, token, { name: `E2E Servo Desligamento ${Date.now()}` });
});

test.afterAll(async () => {
  await deleteStaff(api, token, staff.id);
  await api.dispose();
});

const dialog = (page: Page, title: RegExp) => page.getByRole('dialog').filter({ hasText: title });
const today = formatIsoDateBr(todayInSaoPaulo());

test.describe.serial('Desligamento de servo (story 217)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ADMIN desliga o servo com motivo e o detalhe mostra "Desligado"', async ({ page }) => {
    await page.goto(`/staff/${staff.id}`);
    await page.getByRole('button', { name: 'Desligar', exact: true }).click();
    const modal = dialog(page, /Desligar servo/);
    await modal.getByLabel('Motivo').selectOption({ label: 'Outro' });
    await modal.getByRole('button', { name: 'Desligar' }).click();
    await expect(modal.getByText('Descreva o motivo do desligamento.')).toBeVisible();

    await modal.getByLabel('Observação').fill('Mudou de cidade');
    await modal.getByRole('button', { name: 'Desligar' }).click();
    await expect(modal).toHaveCount(0);

    await expect(page.getByText(`Desligado em ${today}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintegrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resetar senha' })).toHaveCount(0);
  });

  test('some de Ativos e aparece no filtro Desligados', async ({ page }) => {
    await page.goto('/staff');
    await expect(page.getByRole('button', { name: 'Ativos' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(staff.name)).toHaveCount(0);

    await page.getByRole('button', { name: 'Desligados' }).click();
    await expect(page.getByText(staff.name)).toBeVisible();
    await page.getByText(staff.name).click();
    await expect(page).toHaveURL(new RegExp(`/staff/${staff.id}`));
  });

  test('Histórico mostra o motivo no período encerrado', async ({ page }) => {
    await page.goto(`/staff/${staff.id}?tab=admissions`);
    const card = page.getByTestId('service-period-card').first();
    await expect(card).toContainText('Encerrado');
    await expect(card).toContainText('Outro');
    await expect(card).toContainText('Mudou de cidade');
  });

  test('ADMIN reintegra e o Histórico ganha um período novo', async ({ page }) => {
    await page.goto(`/staff/${staff.id}`);
    await page.getByRole('button', { name: 'Reintegrar' }).click();
    const modal = dialog(page, /Reintegrar servo/);
    await modal.getByRole('button', { name: 'Reintegrar' }).click();
    await expect(modal).toHaveCount(0);

    await expect(page.getByText(/Desligado em/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Desligar', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Histórico' }).click();
    const cards = page.getByTestId('service-period-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Em andamento');
    await expect(cards.nth(1)).toContainText('Mudou de cidade');
  });
});
