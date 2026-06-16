import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Curso Bíblico', () => {
  const ts = () => Date.now();
  const cardSelector = '.rounded-lg.border.bg-card';

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Curso Bíblico' }).click();
    await expect(page).toHaveURL('/bible-courses');
  });

  async function createClass(page: Page, name: string) {
    await page.getByRole('button', { name: 'Nova turma' }).click();
    await page.getByLabel('Nome *').fill(name);
    // Casa mãe pode não estar marcada no seed → garantir uma casa selecionada.
    await page.getByLabel('Casa *').selectOption({ index: 1 });
    // Início e término já vêm com defaults (hoje / +75 dias).
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  test('exibe estado vazio ou lista de turmas', async ({ page }) => {
    const isEmpty = await page
      .getByText('Nenhuma turma cadastrada.')
      .isVisible()
      .catch(() => false);
    if (!isEmpty) {
      await expect(page.locator(cardSelector).first()).toBeVisible();
    }
  });

  test('cria nova turma e aparece na lista', async ({ page }) => {
    await createClass(page, `Turma E2E ${ts()}`);
  });

  test('edita turma existente', async ({ page }) => {
    const name = `Turma Editar ${ts()}`;
    const updated = `${name} (Editada)`;
    await createClass(page, name);

    const row = page.locator(cardSelector).filter({ hasText: name });
    await row.getByTitle('Editar').click();
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(updated)).toBeVisible();
  });

  test('abre detalhe e altera status da turma', async ({ page }) => {
    const name = `Turma Status ${ts()}`;
    await createClass(page, name);

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);
    await expect(page.getByRole('heading', { name })).toBeVisible();

    await page.locator('select').first().selectOption('IN_PROGRESS');
    await expect(page.getByText('Em andamento').first()).toBeVisible();
  });

  test('matricula filho na turma quando há filhos ativos', async ({ page }) => {
    const name = `Turma Matrícula ${ts()}`;
    await createClass(page, name);

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);

    await page.getByRole('button', { name: 'Matricular filho' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Matricular filho')).toBeVisible();

    const enrollButtons = dialog.getByRole('button', { name: 'Matricular' });
    const count = await enrollButtons.count();
    test.skip(count === 0, 'Sem filhos ativos no seed de teste');

    await enrollButtons.first().click();
    await page.keyboard.press('Escape');
    // Matrícula aparece com badge de status.
    await expect(page.getByText('Matriculado').first()).toBeVisible();
  });

  test('exclui turma e some da lista', async ({ page }) => {
    const name = `Turma Excluir ${ts()}`;
    await createClass(page, name);

    const row = page.locator(cardSelector).filter({ hasText: name });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });
});

test.describe('Curso Bíblico — catálogo de módulos', () => {
  const ts = () => Date.now();
  const cardSelector = '.rounded-lg.border.bg-card';

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Curso Bíblico' }).click();
    await expect(page).toHaveURL('/bible-courses');
    await page.getByRole('link', { name: 'Módulos' }).click();
    await expect(page).toHaveURL('/bible-courses/modules');
  });

  async function createModule(page: Page, name: string) {
    await page.getByRole('button', { name: 'Novo módulo' }).click();
    await page.getByLabel('Nome *').fill(name);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  test('cria módulo no catálogo', async ({ page }) => {
    await createModule(page, `Módulo E2E ${ts()}`);
  });

  test('edita módulo existente', async ({ page }) => {
    const name = `Módulo Editar ${ts()}`;
    const updated = `${name} (Editado)`;
    await createModule(page, name);

    const row = page.locator(cardSelector).filter({ hasText: name });
    await row.getByTitle('Editar').click();
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(updated)).toBeVisible();
  });

  test('exclui módulo e some da lista', async ({ page }) => {
    const name = `Módulo Excluir ${ts()}`;
    await createModule(page, name);

    const row = page.locator(cardSelector).filter({ hasText: name });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });
});

test.describe('Curso Bíblico — lançamento de notas', () => {
  const ts = () => Date.now();

  test('lança nota numa turma com filho e módulo e vê a média', async ({ page }) => {
    await login(page);

    // Garante um módulo no catálogo.
    await page.getByRole('link', { name: 'Curso Bíblico' }).click();
    await expect(page).toHaveURL('/bible-courses');
    await page.getByRole('link', { name: 'Módulos' }).click();
    await expect(page).toHaveURL('/bible-courses/modules');
    await page.getByRole('button', { name: 'Novo módulo' }).click();
    const moduleName = `Módulo Notas ${ts()}`;
    await page.getByLabel('Nome *').fill(moduleName);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(moduleName)).toBeVisible();

    // Cria turma.
    await page.getByRole('link', { name: 'Curso Bíblico' }).click();
    await expect(page).toHaveURL('/bible-courses');
    const className = `Turma Notas ${ts()}`;
    await page.getByRole('button', { name: 'Nova turma' }).click();
    await page.getByLabel('Nome *').fill(className);
    await page.getByLabel('Casa *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(className)).toBeVisible();

    // Abre a turma e matricula um filho (se houver no seed).
    await page.getByText(className).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);
    await page.getByRole('button', { name: 'Matricular filho' }).click();
    const dialog = page.getByRole('dialog');
    const enrollButtons = dialog.getByRole('button', { name: 'Matricular' });
    const count = await enrollButtons.count();
    test.skip(count === 0, 'Sem filhos ativos no seed de teste');
    await enrollButtons.first().click();
    await page.keyboard.press('Escape');

    // Vai para a aba Notas e lança uma nota de prova.
    await page.getByRole('button', { name: 'Notas' }).click();
    const examInput = page.getByLabel(/^Prova de /).first();
    await expect(examInput).toBeVisible();
    await examInput.fill('8');
    await examInput.blur();

    // A média do módulo (8,0) aparece após o autosave.
    await expect(page.getByText('8,0').first()).toBeVisible();
  });
});
