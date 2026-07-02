import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Autenticação', () => {
  test('login válido redireciona para dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  // Story 97 — o servo entra com WhatsApp + senha (o whatsapp do coordenador
  // vem do seed de teste: 11977773000 / coord123).
  test('login por whatsapp + senha redireciona para dashboard', async ({ page }) => {
    await login(page, '11977773000', 'coord123');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('whatsapp desconhecido exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('11900000000');
    await page.getByLabel('Senha').fill('coord123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('login inválido exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('admin@fonte.com');
    await page.getByLabel('Senha').fill('senha_errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('identificador vazio exibe validação do formulário', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Senha').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Informe WhatsApp ou e-mail')).toBeVisible();
  });

  test('logout retorna para login', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');
  });
});
