import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Configurações agora é submenu na sidebar — clicar no botão para expandir
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('exibe página de Templates de documentos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Templates de documentos' })).toBeVisible();
  });

  test('navega para Permissões via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Permissões' }).click();
    await expect(page).toHaveURL('/settings/permissions');
    await expect(page.getByRole('heading', { name: 'Permissões' })).toBeVisible();
  });

  test('navega para App para filhos via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'App para filhos' }).click();
    await expect(page).toHaveURL('/settings/app-filhos');
  });

  test('navega de volta para Templates de documentos', async ({ page }) => {
    await page.getByRole('link', { name: 'Permissões' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
    await expect(page.getByRole('heading', { name: 'Templates de documentos' })).toBeVisible();
  });

  test('submenu permanece aberto ao navegar entre itens de settings', async ({ page }) => {
    await page.getByRole('link', { name: 'Permissões' }).click();
    await expect(page.getByRole('link', { name: 'Templates de documentos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'App para filhos' })).toBeVisible();
  });

  test('submenu fecha ao navegar para outra seção', async ({ page }) => {
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('link', { name: 'Templates de documentos' })).not.toBeVisible();
  });
});
