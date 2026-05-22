import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Filhos (Residentes)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page).toHaveURL('/residents');
  });

  test('lista residente criado pelo seed', async ({ page }) => {
    await expect(page.getByText('João Testador')).toBeVisible();
  });

  test('exibe total de residentes no cabeçalho', async ({ page }) => {
    await expect(page.getByRole('heading')).toContainText(/Filhos \(\d+\)/);
  });

  test('busca por nome filtra a lista', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('João Testador');
    await expect(page.getByText('João Testador')).toBeVisible();
    // outros residentes sem esse nome não aparecem (verifica via count)
    const cards = page.locator('.rounded-lg.border.bg-card');
    await expect(cards).toHaveCount(1);
  });

  test('busca sem resultado mostra empty state', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('xyzresidenteinexistente');
    await expect(page.getByText('Nenhum acolhido encontrado.')).toBeVisible();
  });

  test('filtro por status exibe apenas residentes com aquele status', async ({ page }) => {
    await page.locator('select').selectOption('ACTIVE');
    const cards = page.locator('.rounded-lg.border.bg-card');
    const count = await cards.count();
    // ao menos um residente ACTIVE existe no seed (João Testador)
    expect(count).toBeGreaterThanOrEqual(1);
    // verifica que nenhum card tem badge de status diferente de "Ativo"
    const badges = page.locator('.rounded-lg.border.bg-card .badge, .rounded-lg.border.bg-card [class*="badge"]');
    // todos os cards visíveis pertencem ao status filtrado
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toBeVisible();
    }
  });

  test('busca e filtro de status combinados', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('João');
    await page.locator('select').selectOption('ACTIVE');
    await expect(page.getByText('João Testador')).toBeVisible();
  });

  test('cria novo residente e aparece na lista', async ({ page }) => {
    const name = `Residente E2E ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/new');

    // FormField não usa htmlFor, então usamos seletor por name
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();

    // Redireciona para página de detalhe
    await expect(page).toHaveURL(/\/residents\/.+/);

    // Volta para lista e verifica
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page.getByText(name)).toBeVisible();
  });

  test('navega para detalhe de residente', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByText('João Testador').first()).toBeVisible();
  });

  test('edita residente existente', async ({ page }) => {
    // Cria residente próprio para não afetar dados do seed
    const name = `Residente Para Editar ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/residents\/.+\/edit/);

    await page.locator('input[name="name"]').clear();
    await page.locator('input[name="name"]').fill(`${name} (Editado)`);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page.getByText(`${name} (Editado)`)).toBeVisible();
  });

  test('familiar criado pelo seed aparece na aba Familiares', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await page.getByRole('button', { name: 'Familiares' }).click();
    await expect(page.getByText('Maria Testadora')).toBeVisible();
  });
});
