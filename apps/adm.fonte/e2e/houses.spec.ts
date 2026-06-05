import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const HOUSE_NAME = `Casa E2E ${Date.now()}`;

test.describe('Casas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Casas' }).click();
    await expect(page).toHaveURL('/houses');
  });

  test('lista casas existentes', async ({ page }) => {
    // "Casa Teste" criada pelo seed deve aparecer
    await expect(page.getByText('Casa Teste')).toBeVisible();
  });

  test('cria nova casa e aparece na lista', async ({ page }) => {
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(HOUSE_NAME);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(HOUSE_NAME)).toBeVisible();
  });

  test('edita casa existente', async ({ page }) => {
    const nameToEdit = `${HOUSE_NAME} Para Editar`;
    const updatedName = `${HOUSE_NAME} Editada`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(nameToEdit);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(nameToEdit)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: nameToEdit }).getByTitle('Editar').click();
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(updatedName);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test('exclui casa e some da lista', async ({ page }) => {
    const tempName = `Casa Para Excluir ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(tempName);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: tempName }).getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(tempName)).not.toBeVisible();
  });

  test('modal de editar casa rola verticalmente em viewport baixa', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });

    const nameToEdit = `${HOUSE_NAME} Scroll ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(nameToEdit);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(nameToEdit)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: nameToEdit }).getByTitle('Editar').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // O container do dialog deve permitir scroll interno e estar de fato cortado pela viewport baixa.
    const overflowY = await dialog.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');
    const isScrollable = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // O botão de salvar no rodapé fica acessível via scroll e é clicável.
    const saveButton = page.getByRole('button', { name: 'Salvar' });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test('navega para detalhe da casa e exibe tabs', async ({ page }) => {
    await page.getByText('Casa Teste').click();
    await expect(page).toHaveURL(/\/houses\/.+/);
    await expect(page.getByRole('button', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filhos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Servos' })).toBeVisible();
  });

  test('navega entre tabs da casa', async ({ page }) => {
    await page.getByText('Casa Teste').click();
    await page.getByRole('button', { name: 'Servos' }).click();
    await expect(page).toHaveURL(/tab=staff/);
    await page.getByRole('button', { name: 'Filhos' }).click();
    await expect(page).toHaveURL(/tab=residents/);
  });
});
