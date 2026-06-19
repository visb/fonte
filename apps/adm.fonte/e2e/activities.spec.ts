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

  /**
   * Arrasta o card (pela alça de arraste) até o centro da coluna de destino.
   * O dnd-kit usa PointerSensor com distância mínima de ativação, então movemos
   * o mouse em passos para disparar o início do arraste antes de soltar.
   */
  async function dragCardTo(page: Page, title: string, targetLabel: string) {
    const handle = card(page, title).getByRole('button', { name: 'Arrastar atividade' });
    const target = column(page, targetLabel);
    // O board rola na horizontal; garante o alvo no viewport antes de medir.
    await target.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error('Card ou coluna não encontrados para o arraste.');

    // A alça fica na borda esquerda do card; o dnd-kit translada o overlay a partir
    // da origem do card. Miramos a porção esquerda da coluna-alvo para o overlay
    // cair sobre ela (e não sobre a coluna vizinha à direita).
    const sx = from.x + from.width / 2;
    const sy = from.y + from.height / 2;
    const tx = to.x + 24;
    const ty = to.y + Math.min(to.height / 2, 200);

    // Eventos reais do mouse: o PointerSensor do dnd-kit os rastreia.
    // Move em vários passos com pausas para a detecção de colisão (rAF) rodar.
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Primeiro passo curto vence a activation constraint (6px) sem chegar ao alvo.
    await page.mouse.move(sx + 10, sy + 10, { steps: 5 });
    await page.waitForTimeout(50);
    await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 10 });
    await page.waitForTimeout(50);
    await page.mouse.move(tx, ty, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.move(tx, ty, { steps: 2 });
    await page.waitForTimeout(120);
    await page.mouse.up();
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

  test('card sem responsável mostra "Sem responsável"; após aprovar mostra o nome', async ({
    page,
  }) => {
    await login(page);
    await goto(page);
    const title = `Responsável visual ${ts()}`;
    await createActivity(page, title);

    // Rascunho recém-criado não tem responsável → estado esmaecido.
    await expect(card(page, title).getByText('Sem responsável')).toBeVisible();

    // Enviar e aprovar escolhendo um responsável.
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Agora o card exibe o badge do responsável (não mais "Sem responsável").
    await expect(card(page, title).getByText('A fazer')).toBeVisible();
    await expect(card(page, title).getByText('Sem responsável')).toHaveCount(0);
    await expect(card(page, title).getByTitle(/^Responsável: /)).toBeVisible();
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

  test('arrasta um card de Fazendo para Impedimento (move)', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Arrastar impedir ${ts()}`;
    await createActivity(page, title);

    // Leva até "Fazendo" pelos botões (pré-condição do arraste).
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await card(page, title).getByRole('button', { name: 'Iniciar' }).click();
    await expect(card(page, title).getByText('Fazendo')).toBeVisible();

    // Arrasta Fazendo → Impedimento (colunas adjacentes, transição válida).
    await dragCardTo(page, title, 'Impedimento');
    await expect(card(page, title).getByText('Impedimento')).toBeVisible();
  });

  test('arrastar para coluna inválida não move o card e mostra erro', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Arrastar inválido ${ts()}`;
    await createActivity(page, title);

    // Rascunho → Solicitações (Enviar) para posicionar o card em REQUESTED.
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await expect(card(page, title).getByText('Solicitações')).toBeVisible();

    // REQUESTED → DRAFT (Solicitações → Rascunho, colunas adjacentes) não existe na
    // matriz: o card volta sozinho (sem mutation otimista) e surge o erro.
    await dragCardTo(page, title, 'Rascunho');
    await expect(
      page.getByText('Não é possível mover esta atividade para essa coluna.'),
    ).toBeVisible();
    // Continua em Solicitações.
    await expect(card(page, title).getByText('Solicitações').first()).toBeVisible();
  });

  test('arrastar Solicitações → A fazer abre o dialog de aprovação (ADMIN)', async ({
    page,
  }) => {
    await login(page);
    await goto(page);
    const title = `Arrastar aprovar ${ts()}`;
    await createActivity(page, title);
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await expect(card(page, title).getByText('Solicitações')).toBeVisible();

    // Soltar em "A fazer" abre o dialog em vez de mover direto.
    await dragCardTo(page, title, 'A fazer');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(card(page, title).getByText('A fazer')).toBeVisible();
  });

  test('clicar no card (sem arrastar) ainda abre o modal de detalhes', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Click não arrasta ${ts()}`;
    await createActivity(page, title);

    await card(page, title).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(title)).toBeVisible();
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
