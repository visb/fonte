import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Associados', () => {
  const ts = () => Date.now();

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/billing/associados');
    await expect(page).toHaveURL('/billing/associados');
    await expect(page.getByRole('heading', { name: 'Associados' })).toBeVisible();
  });

  async function createAssociate(page: import('@playwright/test').Page, name: string) {
    await page.getByRole('button', { name: 'Novo associado' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('WhatsApp *').fill('+5562999998888');
    await page.getByLabel('Contribuição (R$) *').fill('75.5');
    await page.getByLabel('Dia de vencimento *').fill('10');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();
  }

  test('exibe link Associados no submenu Faturamento', async ({ page }) => {
    // Em /billing/associados o submenu já está expandido (inBilling).
    await expect(page.getByRole('link', { name: 'Associados' })).toBeVisible();
  });

  test('valida WhatsApp em formato inválido', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo associado' }).click();
    await page.getByLabel('Nome *').fill('Sem E164');
    await page.getByLabel('WhatsApp *').fill('62999998888');
    await page.getByLabel('Contribuição (R$) *').fill('50');
    await page.getByLabel('Dia de vencimento *').fill('10');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(/E\.164/)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('cria associado e aparece na lista com status Pendente', async ({ page }) => {
    const name = `Associado E2E ${ts()}`;
    await createAssociate(page, name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row.getByText('Pendente')).toBeVisible();
  });

  test('edita associado existente', async ({ page }) => {
    const name = `Associado Editar ${ts()}`;
    const updated = `${name} (Editado)`;
    await createAssociate(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Nome *').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: updated })).toBeVisible();
  });

  test('exclui associado e some da lista', async ({ page }) => {
    const name = `Associado Excluir ${ts()}`;
    await createAssociate(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByRole('cell', { name })).not.toBeVisible();
  });
});
