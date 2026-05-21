import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Configurações' }).click();
    // Redireciona para /settings/templates por padrão
    await expect(page).toHaveURL('/settings/templates');
  });

  test('exibe aba Templates de documentos por padrão', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Templates de documentos' })).toBeVisible();
  });

  test('navega para aba Permissões', async ({ page }) => {
    await page.getByRole('link', { name: 'Permissões' }).click();
    await expect(page).toHaveURL('/settings/permissions');
    await expect(page.getByRole('heading', { name: 'Permissões' })).toBeVisible();
  });

  test('navega para aba App para filhos', async ({ page }) => {
    await page.getByRole('link', { name: 'App para filhos' }).click();
    await expect(page).toHaveURL('/settings/app-filhos');
  });

  test('navega de volta para templates', async ({ page }) => {
    await page.getByRole('link', { name: 'Permissões' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
    await expect(page.getByRole('heading', { name: 'Templates de documentos' })).toBeVisible();
  });
});
