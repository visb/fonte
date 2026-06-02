import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Servos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Servos' }).click();
    await expect(page).toHaveURL('/staff');
  });

  test('lista servos existentes', async ({ page }) => {
    // Coordenador criado pelo seed
    await expect(page.getByText('Coordenador Teste')).toBeVisible();
  });

  test('mostra avatar na listagem de servos', async ({ page }) => {
    const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Coordenador Teste' });
    // Avatar circular visível (foto ou ícone fallback) — o badge de papel também usa
    // rounded-full, então alvejamos o container do avatar pelo tamanho fixo.
    await expect(card.locator('.w-10.h-10.rounded-full')).toBeVisible();
  });

  test('cria novo servo e aparece na lista', async ({ page }) => {
    const name = `Servo E2E ${Date.now()}`;
    const email = `servo_e2e_${Date.now()}@fonte.com`;

    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await expect(page).toHaveURL('/staff/new');

    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('E-mail *').fill(email);
    await page.getByLabel('Função *').selectOption('COORDINATOR');
    // Serve na casa (padrão)
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page).toHaveURL('/staff');
    await expect(page.getByText(name)).toBeVisible();
  });

  test('edita servo existente', async ({ page }) => {
    // Cria servo próprio para não afetar "Coordenador Teste" usado em outros testes
    const name = `Servo Para Editar ${Date.now()}`;
    const email = `editar_${Date.now()}@fonte.com`;
    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('E-mail *').fill(email);
    await page.getByLabel('Função *').selectOption('COORDINATOR');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/staff\/.+\/edit/);
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(`${name} (Editado)`);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/staff');
    await expect(page.getByText(`${name} (Editado)`)).toBeVisible();
  });

  test('abre diálogo de resetar senha', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Coordenador Teste' }).getByTitle('Resetar senha').click();
    // Verifica que o dialog de reset abriu
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('exclui servo e some da lista', async ({ page }) => {
    // Cria servo para excluir
    const name = `Servo Para Excluir ${Date.now()}`;
    const email = `excluir_${Date.now()}@fonte.com`;

    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('E-mail *').fill(email);
    await page.getByLabel('Função *').selectOption('OPERATOR');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
