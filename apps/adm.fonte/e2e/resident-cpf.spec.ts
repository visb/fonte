import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { login } from './helpers/auth';
import { createResident, deleteResident, loginApi, type ResidentFixture } from './helpers/api';
import { randomCpf } from './helpers/cpf';

/**
 * Story 219 — CPF do filho é único. O dono do CPF é fixture própria (criada via
 * API e excluída no `afterAll`); o cadastro pelo wizard recebe 409 e não grava
 * nada, então a suíte roda quantas vezes for preciso sem reseed.
 */
test.describe('CPF do filho único (story 219)', () => {
  let api: APIRequestContext;
  let token: string;
  let owner: ResidentFixture;
  const cpf = randomCpf();
  const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext();
    token = await loginApi(api);
    owner = await createResident(api, token, { name: `Dono do CPF ${Date.now()}`, cpf });
  });

  test.afterAll(async () => {
    if (owner) await deleteResident(api, token, owner.id);
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/residents/new');
  });

  test('CPF com DV inválido segura a ficha', async ({ page }) => {
    await page.locator('input[name="name"]').fill(`CPF Inválido ${Date.now()}`);
    await page.locator('input[name="cpf"]').fill('123.456.789-00');
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(page.getByText('CPF inválido.')).toBeVisible();
    await expect(page.locator('select[name="houseId"]')).toHaveCount(0);
  });

  test('CPF já usado por outro filho → erro no campo com link para o cadastro', async ({ page }) => {
    await page.locator('input[name="name"]').fill(`CPF Repetido ${Date.now()}`);
    await page.locator('input[name="cpf"]').fill(cpf);
    await expect(page.locator('input[name="cpf"]')).toHaveValue(masked);
    await page.getByRole('button', { name: 'Avançar' }).click();

    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Avançar' }).click();

    // Volta para a ficha com o erro no campo CPF.
    const error = page.getByRole('alert').filter({ hasText: 'Já existe um filho com este CPF' });
    await expect(error).toBeVisible();
    await expect(error).toContainText(owner.name);
    await expect(error.getByRole('link', { name: 'Ver cadastro' })).toHaveAttribute(
      'href',
      `/residents/${owner.id}`,
    );
    await expect(page.locator('input[name="cpf"]')).toHaveValue(masked);
  });
});
