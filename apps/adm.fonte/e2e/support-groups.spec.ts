import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Grupos de Apoio', () => {
  const ts = () => Date.now();

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Grupos de Apoio' }).click();
    await expect(page).toHaveURL('/support-groups');
  });

  async function createGroup(page: import('@playwright/test').Page, name: string) {
    await page.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('Nome da Igreja *').fill('Igreja Teste');
    await page.getByLabel('Endereço *').fill('Rua Teste, 100');
    await page.getByLabel('Dia da semana *').selectOption('6'); // Sábado
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  test('exibe estado vazio ou lista de grupos', async ({ page }) => {
    const isEmpty = await page.getByText('Nenhum grupo de apoio cadastrado.').isVisible().catch(() => false);
    if (!isEmpty) {
      await expect(page.locator('.rounded-lg.border.bg-card').first()).toBeVisible();
    }
  });

  test('cria novo grupo e aparece na lista', async ({ page }) => {
    await createGroup(page, `Grupo E2E ${ts()}`);
  });

  test('expande grupo e exibe histórico de reuniões', async ({ page }) => {
    const name = `Grupo Expandir ${ts()}`;
    await createGroup(page, name);

    // Clica no nome do grupo para expandir
    await page.getByText(name).click();
    await expect(page.getByText('Histórico de reuniões')).toBeVisible();
  });

  test('edita grupo existente', async ({ page }) => {
    const name = `Grupo Para Editar ${ts()}`;
    const updated = `${name} (Editado)`;
    await createGroup(page, name);

    const row = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
    await row.getByTitle('Editar').click();
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(updated)).toBeVisible();
  });

  test('exclui grupo e some da lista', async ({ page }) => {
    const name = `Grupo Para Excluir ${ts()}`;
    await createGroup(page, name);

    const row = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
    await row.locator('button').last().click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
