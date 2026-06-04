import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('exibe o título e a ação de novo acolhimento', async ({ page }) => {
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Novo acolhimento/ })).toBeVisible();
  });

  test('mostra a seção de ocupação das casas (seed possui Casa Teste)', async ({ page }) => {
    await expect(page.getByText('Ocupação das Casas')).toBeVisible();
    await expect(page.getByText('Casa Teste').first()).toBeVisible();
  });

  test('ação de novo acolhimento leva ao gateway de admissão', async ({ page }) => {
    await page.getByRole('link', { name: /Novo acolhimento/ }).click();
    await expect(page).toHaveURL('/residents/admission');
  });
});
