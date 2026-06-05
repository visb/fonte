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

  // ─── Regressão story-12: coordenador preenchido com /staff lento ─────────────

  test('editar grupo com coordenador preenche o campo Coordenador mesmo com /staff lento', async ({ page }) => {
    // Cria um grupo e define um coordenador (Coordenador Teste do seed).
    const name = `Grupo Coord ${ts()}`;
    await createGroup(page, name);

    const row = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Coordenador (opcional)').selectOption({ label: 'Coordenador Teste' });
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Força a corrida: atrasa GET /staff e recarrega a página (limpa o cache do
    // react-query). Ao abrir o diálogo, o reset() aplica o coordinatorId antes
    // de o /staff resolver — sem as <option> do staff o <select> nativo descarta
    // o valor. O fix (opção B) reaplica via setValue quando o staff chega.
    await page.route('**/api/v1/staff', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.reload();
    await expect(page).toHaveURL('/support-groups');

    const reloadedRow = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
    await reloadedRow.getByTitle('Editar').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const coordSelect = page.getByLabel('Coordenador (opcional)');
    await expect(coordSelect).toHaveValue(/.+/);
    await expect(coordSelect).toContainText('Coordenador Teste');
  });

  // ─── Reuniões + check-in de famílias ─────────────────────────────────────────

  test('abre modal de famílias presentes a partir do grupo do seed', async ({ page }) => {
    // O seed cria "Grupo Esperança" com uma reunião hoje.
    await page.getByText('Grupo Esperança').click();
    await expect(page.getByText('Histórico de reuniões')).toBeVisible();

    // O contador de famílias da reunião abre o modal de presenças.
    await page.getByRole('button', { name: /família/ }).first().click();
    await expect(page.getByText('Famílias presentes')).toBeVisible();
  });
});
