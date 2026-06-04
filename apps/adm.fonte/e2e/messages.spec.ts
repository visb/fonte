import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Mensagens', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Mensagens' }).click();
    await expect(page).toHaveURL('/messages');
  });

  test('exibe as abas Filhos↔Familiares e Servos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mensagens' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filhos ↔ Familiares' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Servos' })).toBeVisible();
  });

  test('lista a conversa do seed (João Testador) agrupada pela casa', async ({ page }) => {
    // O seed cria uma mensagem aprovada na thread João Testador ↔ Maria Testadora.
    await expect(page.getByText('Casa Teste').first()).toBeVisible();
    await expect(page.getByText('João Testador').first()).toBeVisible();
  });

  test('abre a thread ao selecionar a conversa', async ({ page }) => {
    await page.getByText('João Testador').first().click();
    // O painel da thread mostra o título (heading) com os dois lados da conversa.
    await expect(page.getByRole('heading', { name: /João Testador.*Maria Testadora/ })).toBeVisible();
  });

  test('alterna para a aba Servos', async ({ page }) => {
    await page.getByRole('button', { name: 'Servos' }).click();
    // Sem conversas diretas no seed → estado vazio.
    await expect(page.getByText(/Nenhuma conversa/)).toBeVisible();
  });
});
