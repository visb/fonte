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
    await expect(page.getByRole('heading', { name: /Filhos/ })).toContainText(/Filhos \(\d+\)/);
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
    // aguarda re-render após filtro aplicado
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    // ao menos um residente ACTIVE existe no seed (João Testador)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('busca e filtro de status combinados', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('João');
    await page.locator('select').selectOption('ACTIVE');
    await expect(page.getByText('João Testador')).toBeVisible();
  });

  // ─── Gateway de novo acolhimento ────────────────────────────────────────────

  test('"Novo acolhimento" navega para gateway /residents/admission', async ({ page }) => {
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/admission');
    await expect(page.getByRole('link', { name: /Primeiro acolhimento/ })).toBeVisible();
    await expect(page.getByText('Já passou pela casa').first()).toBeVisible();
  });

  test('gateway: "Primeiro acolhimento" navega para /residents/new', async ({ page }) => {
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/admission');
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await expect(page).toHaveURL('/residents/new');
  });

  // ─── Criação de residente ────────────────────────────────────────────────────

  test('cria novo residente via gateway e aparece na lista', async ({ page }) => {
    const name = `Residente E2E ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/admission');

    // Navega para formulário de primeiro acolhimento
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await expect(page).toHaveURL('/residents/new');

    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();

    // Redireciona para página de detalhe
    await expect(page).toHaveURL(/\/residents\/.+/);

    // Volta para lista e verifica
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page.getByText(name)).toBeVisible();
  });

  // ─── Navegação e edição ──────────────────────────────────────────────────────

  test('navega para detalhe de residente', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByText('João Testador').first()).toBeVisible();
  });

  test('edita residente existente', async ({ page }) => {
    // Cria residente próprio para não afetar dados do seed
    const name = `Residente Para Editar ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
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

  // ─── Aba Histórico ───────────────────────────────────────────────────────────

  test('aba Histórico aparece na página de detalhe', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeVisible();
  });

  test('aba Histórico mostra acolhimento do residente criado via API', async ({ page }) => {
    const name = `Residente Histórico ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    await page.getByRole('button', { name: 'Histórico' }).click();
    const admissionCard = page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Acolhimento 1' });
    await expect(admissionCard).toBeVisible();
    await expect(admissionCard.getByText('Casa Teste')).toBeVisible();
  });

  // ─── Botão Reintroduzir ──────────────────────────────────────────────────────

  test('residente ACTIVE não exibe botão Reintroduzir', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByRole('link', { name: 'Reintroduzir' })).not.toBeVisible();
  });

  test('residente DISCHARGED exibe botão Reintroduzir que leva a /residents/readmit/:id', async ({ page }) => {
    // Cria residente e navega para seu detalhe
    const name = `Residente Alta ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    // Muda para DISCHARGED via edição
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/residents\/.+\/edit/);
    await page.locator('select[name="status"]').selectOption('DISCHARGED');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    // Botão Reintroduzir deve aparecer
    await expect(page.getByRole('link', { name: /Reintroduzir/ })).toBeVisible();

    // Clique deve ir para /residents/readmit/:id
    await page.getByRole('link', { name: /Reintroduzir/ }).click();
    await expect(page).toHaveURL(/\/residents\/readmit\/.+/);
  });

  // ─── Gateway: reintrodução via busca ────────────────────────────────────────

  test('gateway exibe "Iniciar reintrodução" ao selecionar residente DISCHARGED', async ({ page }) => {
    // Cria residente e coloca em DISCHARGED
    const name = `Residente Reintr ${Date.now()}`;
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Registrar acolhimento' }).click();

    await page.getByRole('link', { name: 'Editar' }).click();
    await page.locator('select[name="status"]').selectOption('DISCHARGED');
    await page.getByRole('button', { name: 'Salvar' }).click();

    // Volta para lista e abre gateway
    await page.getByRole('link', { name: 'Filhos' }).click();
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/admission');

    // Busca o residente
    await page.getByPlaceholder('Nome ou CPF...').fill(name.slice(0, 10));
    await page.waitForTimeout(400); // debounce

    const dropdownItem = page.getByText(name, { exact: false }).first();
    await expect(dropdownItem).toBeVisible();
    await dropdownItem.click();

    // Botão de iniciar reintrodução deve aparecer
    await expect(page.getByRole('button', { name: 'Iniciar reintrodução' })).toBeVisible();
  });
});
