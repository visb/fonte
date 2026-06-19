import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Atividades (board Kanban)', () => {
  const ts = () => Date.now();

  async function goto(page: Page) {
    await page.goto('/activities');
    await expect(page).toHaveURL('/activities');
    await expect(page.getByRole('heading', { name: 'Atividades' })).toBeVisible();
  }

  /** Cria uma atividade pelo dialog. Como ADMIN sem casa, nasce em Rascunho. */
  async function createActivity(page: Page, title: string) {
    await page.getByRole('button', { name: 'Nova atividade' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Título *').fill(title);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  }

  /** O card da atividade pelo título. */
  function card(page: Page, title: string) {
    return page.locator('div.rounded-md.border.bg-card').filter({ hasText: title });
  }

  /** A coluna do board pelo rótulo do cabeçalho (Rascunho, A fazer, ...). */
  function column(page: Page, label: string) {
    return page
      .locator('div.w-72')
      .filter({ has: page.getByText(label, { exact: true }) });
  }

  test('ADMIN vê o item Atividades no menu e navega', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Atividades' }).click();
    await expect(page).toHaveURL('/activities');
    await expect(page.getByRole('heading', { name: 'Atividades' })).toBeVisible();
  });

  test('exibe as 6 colunas do board', async ({ page }) => {
    await login(page);
    await goto(page);
    for (const label of [
      'Rascunho',
      'Solicitações',
      'A fazer',
      'Fazendo',
      'Impedimento',
      'Concluídas',
    ]) {
      // O label aparece no cabeçalho da coluna (e pode repetir em badges de card),
      // então basta confirmar ao menos uma ocorrência visível.
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('cria uma atividade (nasce em Rascunho)', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Consertar portão ${ts()}`;
    await createActivity(page, title);
    await expect(card(page, title).getByText('Rascunho')).toBeVisible();
  });

  test('aprova uma solicitação escolhendo o responsável (→ A fazer)', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Pintar muro ${ts()}`;
    await createActivity(page, title);

    // Rascunho → Solicitações (Enviar)
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await expect(card(page, title).getByText('Solicitações')).toBeVisible();

    // Solicitações → A fazer (Aprovar, escolhe responsável)
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(card(page, title).getByText('A fazer')).toBeVisible();
  });

  test('move um card de A fazer para Fazendo', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Trocar lâmpada ${ts()}`;
    await createActivity(page, title);

    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // A fazer → Fazendo (Iniciar)
    await card(page, title).getByRole('button', { name: 'Iniciar' }).click();
    await expect(card(page, title).getByText('Fazendo')).toBeVisible();
  });

  test('cria atividade inline (quick-add) na coluna Rascunho com só o título', async ({
    page,
  }) => {
    await login(page);
    await goto(page);

    const draft = column(page, 'Rascunho');
    const title = `Quick add ${ts()}`;

    // Abre o quick-add no rodapé da coluna e digita só o título.
    await draft.getByRole('button', { name: 'Adicionar atividade' }).click();
    const input = draft.getByLabel('Título da nova atividade');
    await input.fill(title);
    await input.press('Enter');

    // O card aparece na coluna Rascunho.
    await expect(card(page, title)).toBeVisible();
    await expect(card(page, title).getByText('Rascunho')).toBeVisible();
  });

  test('clicar num card abre o modal de detalhes e edita a descrição (ADMIN)', async ({
    page,
  }) => {
    await login(page);
    await goto(page);
    const title = `Detalhe ${ts()}`;
    await createActivity(page, title);

    // Abre o modal de detalhes ao clicar no card.
    await card(page, title).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(title)).toBeVisible();
    // Infos do detalhe presentes.
    await expect(dialog.getByText('Casa', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Responsável', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Criado por', { exact: true })).toBeVisible();

    // ADMIN edita a descrição inline (campo liberado em qualquer status).
    const desc = `Descrição atualizada ${ts()}`;
    await dialog.getByLabel('Descrição').fill(desc);
    await dialog.getByRole('button', { name: 'Salvar descrição' }).click();

    // Após salvar, reabrir o card mostra a descrição persistida.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await card(page, title).click();
    await expect(page.getByRole('dialog').getByLabel('Descrição')).toHaveValue(desc);
  });

  test('coluna "A fazer" não exibe o quick-add', async ({ page }) => {
    await login(page);
    await goto(page);

    const todo = column(page, 'A fazer');
    await expect(
      todo.getByRole('button', { name: 'Adicionar atividade' }),
    ).toHaveCount(0);
    await expect(todo.getByLabel('Título da nova atividade')).toHaveCount(0);
  });
});
