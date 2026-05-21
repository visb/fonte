import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Autenticação', () => {
  test('login válido redireciona para dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('login inválido exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@fonte.com');
    await page.getByLabel('Senha').fill('senha_errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('email inválido exibe validação do formulário', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nao-é-email');
    await page.getByLabel('Senha').fill('123456');
    // Bypass HTML5 native email validation so Zod/RHF can show the error
    await page.getByLabel('E-mail').evaluate((el) => (el as HTMLInputElement).type = 'text');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail inválido')).toBeVisible();
  });

  test('logout retorna para login', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');
  });
});
