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

  // Painel de sugeridos (story 125): o cabeçalho também é um checkbox, então as
  // linhas precisam ser localizadas pelo aria-label próprio de cada filho.
  const selectAllBox = (page: Page) => page.getByRole('checkbox', { name: 'Selecionar todos' });
  const eligibleRowBoxes = (page: Page) =>
    page.getByRole('checkbox', { name: /^Selecionar (?!todos)/ });

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

  test('sugere matrícula de elegíveis ao abrir turma sem matrículas (story 99)', async ({ page }) => {
    const name = `Turma Sugestão ${ts()}`;
    await createClass(page, name);

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);

    // Painel de sugestões pós-criação: lista elegíveis marcados ou empty state.
    const heading = page.getByRole('heading', { name: 'Sugestões de matrícula' });
    await expect(heading.or(page.getByText('Nenhum filho elegível.'))).toBeVisible();
    const hasEligible = await heading.isVisible();
    test.skip(!hasEligible, 'Sem filhos elegíveis (3+ meses) no seed de teste');

    const rows = eligibleRowBoxes(page);
    const count = await rows.count();

    // Elegíveis vêm marcados por padrão.
    await expect(rows.first()).toBeChecked();

    // Se há mais de um elegível, desmarca o primeiro (ainda sobra selecionado).
    if (count > 1) {
      await rows.first().click();
      await expect(rows.first()).not.toBeChecked();
    }

    // Matricula os selecionados restantes → refletido como matrícula na turma.
    await page.getByRole('button', { name: /Matricular selecionados \([1-9]/ }).click();
    await expect(page.getByText('Matriculado').first()).toBeVisible();
  });

  test('seleciona/deseleciona todos os sugeridos e matricula (story 125)', async ({ page }) => {
    const name = `Turma Todos ${ts()}`;
    await createClass(page, name);

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);

    const heading = page.getByRole('heading', { name: 'Sugestões de matrícula' });
    await expect(heading.or(page.getByText('Nenhum filho elegível.'))).toBeVisible();
    const hasEligible = await heading.isVisible();
    test.skip(!hasEligible, 'Sem filhos elegíveis (3+ meses) no seed de teste');

    const header = selectAllBox(page);
    const rows = eligibleRowBoxes(page);

    // Default da story 99 não regride: todos marcados.
    await expect(header).toBeChecked();
    await expect(rows.first()).toBeChecked();

    // Desmarca todos pelo cabeçalho → botão sem contagem fica desabilitado.
    await header.click();
    await expect(rows.first()).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Matricular selecionados (0)' })).toBeDisabled();

    // Marca todos de novo e matricula → matrículas aparecem na turma.
    await header.click();
    await expect(header).toBeChecked();
    await expect(rows.first()).toBeChecked();
    await page.getByRole('button', { name: /Matricular selecionados \([1-9]/ }).click();
    await expect(page.getByText('Matriculado').first()).toBeVisible();
  });

  // Story 126: feedback de ação é toast (sonner), não texto inline no dialog.
  test('criar turma mostra toast de sucesso', async ({ page }) => {
    const name = `Turma Toast ${ts()}`;
    await createClass(page, name);

    await expect(page.getByText('Turma criada.')).toBeVisible();
  });

  test('erro na criação da turma mostra toast de erro (story 126)', async ({ page }) => {
    // Só o POST de criação falha — o GET da lista segue normal.
    await page.route('**/api/v1/bible-course/classes', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha proposital do e2e' }),
      });
    });

    await page.getByRole('button', { name: 'Nova turma' }).click();
    await page.getByLabel('Nome *').fill(`Turma Erro ${ts()}`);
    await page.getByLabel('Casa *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Criar' }).click();

    // A mensagem da API chega via getErrorMessage; o dialog não fecha.
    await expect(page.getByText('Falha proposital do e2e')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('exclui turma e some da lista', async ({ page }) => {
    const name = `Turma Excluir ${ts()}`;
    await createClass(page, name);

    const row = page.locator(cardSelector).filter({ hasText: name });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('sobe e remove uma foto da turma (story 92)', async ({ page }) => {
    const name = `Turma Fotos ${ts()}`;
    await createClass(page, name);

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/bible-courses\/.+/);

    // Aba de fotos: estado vazio.
    await page.getByRole('button', { name: 'Fotos' }).click();
    await expect(page.getByText('Nenhuma foto nesta turma.')).toBeVisible();

    // 1x1 PNG transparente.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: 'foto-e2e.png',
      mimeType: 'image/png',
      buffer: png,
    });

    const thumb = page.getByAltText('foto-e2e.png');
    await expect(thumb).toBeVisible();

    // Remove a foto (confirm nativo aceito automaticamente).
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Remover foto foto-e2e.png' }).click({ force: true });
    await expect(page.getByText('Nenhuma foto nesta turma.')).toBeVisible();
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

    // Vai para a aba Notas e abre o lançamento do módulo (matriz read-only).
    await page.getByRole('button', { name: 'Notas' }).click();
    await page.getByRole('button', { name: `Lançar notas — ${moduleName}` }).click();

    // No dialog, lança a nota de prova e salva.
    const gradeDialog = page.getByRole('dialog');
    const examInput = gradeDialog.getByLabel(/^Prova de /).first();
    await expect(examInput).toBeVisible();
    await examInput.fill('8');
    await gradeDialog.getByRole('button', { name: 'Salvar' }).click();

    // A média do módulo (8,0) aparece na matriz após salvar.
    await expect(page.getByText('8,0').first()).toBeVisible();
  });
});
