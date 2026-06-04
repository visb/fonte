import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Faturamento', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('submenu Faturamento expande e mostra as seções', async ({ page }) => {
    await page.getByRole('button', { name: 'Faturamento' }).click();
    await expect(page.getByRole('link', { name: 'Pizza' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pão' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Associados' })).toBeVisible();
  });

  test('página de Filhos — Contribuições renderiza com filtros', async ({ page }) => {
    await page.goto('/billing/filhos');
    await expect(page.getByRole('heading', { name: /Filhos — Contribuições/ })).toBeVisible();
    await expect(page.getByLabel('Mês')).toBeVisible();
    await expect(page.getByLabel('Casa')).toBeVisible();
  });

  test('navega para a seção Pizza pelo submenu', async ({ page }) => {
    await page.getByRole('button', { name: 'Faturamento' }).click();
    await page.getByRole('link', { name: 'Pizza' }).click();
    await expect(page).toHaveURL('/billing/pizza');
  });
});
