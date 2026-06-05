import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createResidentViaWizard, openResidentFromList } from './helpers/residents';

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
    // A página tem dois selects (status e casa); o status é o primeiro.
    await page.locator('select').first().selectOption('ACTIVE');
    const cards = page.locator('.rounded-lg.border.bg-card');
    // aguarda re-render após filtro aplicado
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    // ao menos um residente ACTIVE existe no seed (João Testador)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('busca e filtro de status combinados', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('João');
    await page.locator('select').first().selectOption('ACTIVE');
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
    await createResidentViaWizard(page, name);

    // Volta para lista e verifica
    await openResidentFromList(page, name);
  });

  test('conclui acolhimento e redireciona para detalhe na aba Visão Geral', async ({ page }) => {
    const name = `Residente Conclui ${Date.now()}`;
    await createResidentViaWizard(page, name);

    // Step 2 — cadastra um familiar para habilitar o avanço.
    await page.getByRole('button', { name: 'Adicionar familiar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#rel-name').fill(`Familiar ${name}`);
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Step 2 → 3 (Documentos).
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(
      page.getByText('Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.'),
    ).toBeVisible();

    // Documentos são opcionais: o botão "Concluir acolhimento" já fica
    // habilitado sem nenhum upload (story 14).
    const concludeButton = page.getByRole('button', { name: 'Concluir acolhimento' });
    await expect(concludeButton).toBeEnabled();
    await concludeButton.click();

    // Redireciona para o detalhe do filho com a aba Visão Geral explícita.
    await expect(page).toHaveURL(/\/residents\/[^/]+\?tab=overview$/);

    // A aba "Visão Geral" está ativa (estilo de aba selecionada).
    const overviewTab = page.getByRole('button', { name: 'Visão Geral' });
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveClass(/border-primary/);
  });

  test('conclui acolhimento sem assinar nenhum documento (docs opcionais)', async ({ page }) => {
    const name = `Residente Sem Docs ${Date.now()}`;
    await createResidentViaWizard(page, name);

    // Etapa 2 (Familiares) → Documentos, sem cadastrar familiar.
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(
      page.getByText('Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.'),
    ).toBeVisible();

    // Nenhum documento assinado: botão "Concluir acolhimento" habilitado.
    const concludeButton = page.getByRole('button', { name: 'Concluir acolhimento' });
    await expect(concludeButton).toBeEnabled();
    await concludeButton.click();

    // Redireciona para o detalhe na aba Visão Geral (conclusão bem-sucedida).
    await expect(page).toHaveURL(/\/residents\/[^/]+\?tab=overview$/);
    const overviewTab = page.getByRole('button', { name: 'Visão Geral' });
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveClass(/border-primary/);
  });

  test('avança da aba Familiares sem cadastrar nenhum familiar', async ({ page }) => {
    const name = `Residente Sem Familiar ${Date.now()}`;
    await createResidentViaWizard(page, name);

    // Etapa 2 (Familiares) — nenhum familiar cadastrado.
    const nextButton = page.getByRole('button', { name: 'Avançar' });
    // O botão "Avançar" deve estar habilitado mesmo sem familiar.
    await expect(nextButton).toBeEnabled();

    // Avança para a etapa Documentos.
    await nextButton.click();
    await expect(
      page.getByText('Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.'),
    ).toBeVisible();
  });

  test('(regressão) avança da aba Familiares com familiar cadastrado', async ({ page }) => {
    const name = `Residente Com Familiar ${Date.now()}`;
    await createResidentViaWizard(page, name);

    // Etapa 2 — cadastra um familiar.
    await page.getByRole('button', { name: 'Adicionar familiar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#rel-name').fill(`Familiar ${name}`);
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Avança para a etapa Documentos.
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(
      page.getByText('Gere e anexe os documentos assinados. Você pode concluir agora e anexá-los depois.'),
    ).toBeVisible();
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
    await createResidentViaWizard(page, name);

    const card = await openResidentFromList(page, name);
    await card.getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/residents\/.+\/edit/);

    await page.locator('input[name="name"]').clear();
    await page.locator('input[name="name"]').fill(`${name} (Editado)`);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await openResidentFromList(page, `${name} (Editado)`);
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

  test('aba Histórico mostra acolhimento do residente criado via wizard', async ({ page }) => {
    const name = `Residente Histórico ${Date.now()}`;
    await createResidentViaWizard(page, name);

    const card = await openResidentFromList(page, name);
    await card.first().click();
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
    await createResidentViaWizard(page, name);

    const card = await openResidentFromList(page, name);
    await card.first().click();
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
    await createResidentViaWizard(page, name);

    const card = await openResidentFromList(page, name);
    await card.first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    await page.getByRole('link', { name: 'Editar' }).click();
    await page.locator('select[name="status"]').selectOption('DISCHARGED');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    // Volta para lista e abre gateway de novo acolhimento
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page).toHaveURL('/residents');
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await expect(page).toHaveURL('/residents/admission');

    // Busca o residente pelo nome completo (único via timestamp) — buscas curtas
    // batem em muitos residentes acumulados e o item não entra no dropdown.
    await page.getByPlaceholder('Nome ou CPF...').fill(name);
    await page.waitForTimeout(400); // debounce

    const dropdownItem = page.getByText(name, { exact: false }).first();
    await expect(dropdownItem).toBeVisible();
    await dropdownItem.click();

    // Botão de iniciar reintrodução deve aparecer
    await expect(page.getByRole('button', { name: 'Iniciar reintrodução' })).toBeVisible();
  });

  // ─── Filtro por casa ─────────────────────────────────────────────────────────

  test('filtro por casa exibe residentes da casa selecionada', async ({ page }) => {
    // A página tem dois selects: [0] status, [1] casa.
    await page.locator('select').nth(1).selectOption({ label: 'Casa Teste' });
    await expect(page.getByText('João Testador')).toBeVisible();
  });

  test('botão "Contribuição em atraso" alterna o filtro', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Contribuição em atraso' });
    await button.click();
    // Lista re-renderiza sem erro (pode ficar vazia conforme dados do seed).
    await expect(button).toBeVisible();
  });

  // ─── Aba Contribuição (recebíveis + plano) ──────────────────────────────────

  test('aba Contribuição: define plano e registra pagamento de parcela', async ({ page }) => {
    // Usa o acolhido do seed (João Testador), que tem entry_date definida —
    // garantindo a geração das parcelas ao definir um plano pagante.
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    await page.getByRole('button', { name: 'Contribuição' }).click();

    // Define o plano (default do diálogo é Pagamento R$700) → gera o carnê.
    // Dia de vencimento fica em branco de propósito: o campo é opcional e o
    // submit deve passar mesmo vazio (cai no dia do acolhimento).
    await page.getByRole('button', { name: 'Alterar plano' }).click();
    await expect(page.getByText('Alterar plano de contribuição')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();

    // As parcelas obrigatórias aparecem com a ação de pagamento.
    const payButton = page.getByRole('button', { name: 'Registrar pagamento' }).first();
    await expect(payButton).toBeVisible();
    await payButton.click();

    // Diálogo de pagamento (data e PIX já vêm preenchidos por padrão).
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // A parcela passa a exibir o estado "Pago em ...".
    await expect(page.getByText(/Pago em/).first()).toBeVisible();
  });
});
