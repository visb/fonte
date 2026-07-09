import { test, expect, type Page } from '@playwright/test';
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

  test('(regressão story-12) editar filho com casa preenche o campo Casa mesmo com /houses lento', async ({ page }) => {
    // João Testador é do seed e está vinculado à "Casa Teste".
    const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first();
    await card.getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/residents\/.+\/edit/);
    const editUrl = page.url();

    // Força a corrida: atrasa GET /houses para chegar DEPOIS do residente. O
    // reload limpa o cache do react-query, então as casas vêm da rede (lentas)
    // enquanto GET /residents/:id chega rápido.
    await page.route('**/api/v1/houses', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(editUrl);

    // Sem o fix, o <select> nativo descarta o houseId aplicado pelo reset()
    // porque as <option> de casas ainda não existiam. Com o fix, vem preenchido.
    const houseSelect = page.locator('select[name="houseId"]');
    await expect(houseSelect).toHaveValue(/.+/);
    await expect(houseSelect).toContainText('Casa Teste');
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

  // ─── Importar com IA: resumo completo (story-17) ────────────────────────────

  // Mock fixo do parse-docx para tornar o fluxo determinístico (sem depender da
  // IA). A casa é resolvida por houseName → houseId no passo de revisão, então o
  // resumo deve exibir o NOME da casa (não o UUID) e o LABEL da modalidade.
  const parsedResident = {
    name: 'Filho Importado IA',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    nationality: 'Brasileira',
    birthDate: '1990-05-20',
    gender: 'MALE',
    address: 'Rua das Flores, 100',
    city: 'São Paulo',
    state: 'SP',
    contactPhone: '(11) 98888-7777',
    email: 'filho.ia@example.com',
    maritalStatus: 'SINGLE',
    children: '2',
    occupation: 'Pedreiro',
    education: 'Ensino médio completo',
    religion: 'Evangélico',
    addiction: 'Álcool',
    healthIssues: 'Hipertensão',
    continuousMedication: 'Losartana',
    weight: '80',
    height: '175',
    familyInvestment: 'BASKET_500',
  };

  async function startImportWithMockedParse(page: Page) {
    await page.route('**/api/v1/residents/import/parse-docx', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          resident: parsedResident,
          relatives: [],
          warnings: {},
          houseName: 'Casa Teste',
          rawText: 'texto da ficha',
          photoBase64: null,
        }),
      });
    });

    await page.getByRole('link', { name: 'Importar', exact: true }).click();
    await expect(page).toHaveURL('/import');
    await page.getByRole('link', { name: 'Individual' }).click();
    await expect(page).toHaveURL('/residents/import');

    // Upload do .docx (conteúdo irrelevante — a resposta é mockada).
    await page.locator('input[type="file"]').setInputFiles({
      name: 'ficha.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('conteudo da ficha'),
    });

    // Passo 2 (Revisar) — seleciona a casa explicitamente para garantir o
    // houseId no resumo (o resumo deve então mostrar o NOME da casa).
    await expect(page.getByRole('heading', { name: 'Revisar dados do residente' })).toBeVisible();
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
  }

  test('importar com IA: resumo mostra todos os campos com label e valor legível', async ({ page }) => {
    await startImportWithMockedParse(page);

    // Avança Revisar → Familiares → Documentos → Resumo.
    await page.getByRole('button', { name: /Próximo: Familiares/ }).click();
    await page.getByRole('button', { name: /Próximo: Resumo/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Resumo da importação' })).toBeVisible();

    // Seções agrupadas presentes.
    await expect(page.getByText('Ficha de cadastro')).toBeVisible();
    await expect(page.getByText('Admissão', { exact: true })).toBeVisible();

    const summary = page.locator('div.space-y-5');

    // Campos além do subconjunto antigo (endereço, escolaridade, etc.).
    await expect(summary.getByText('Endereço', { exact: true })).toBeVisible();
    await expect(summary.getByText('Rua das Flores, 100')).toBeVisible();
    await expect(summary.getByText('Escolaridade', { exact: true })).toBeVisible();
    await expect(summary.getByText('Ensino médio completo')).toBeVisible();
    await expect(summary.getByText('Ocupação', { exact: true })).toBeVisible();
    await expect(summary.getByText('Pedreiro')).toBeVisible();

    // Casa: nome legível, não UUID.
    await expect(summary.getByText('Casa', { exact: true })).toBeVisible();
    await expect(summary.getByText('Casa Teste')).toBeVisible();

    // Modalidade: label, não enum cru.
    await expect(summary.getByText('Modalidade', { exact: true })).toBeVisible();
    await expect(summary.getByText('R$ 500 + cestas')).toBeVisible();
    await expect(summary.getByText('BASKET_500')).toHaveCount(0);

    // Gênero/estado civil: labels legíveis.
    await expect(summary.getByText('Masculino')).toBeVisible();
    await expect(summary.getByText('Solteiro(a)')).toBeVisible();
    await expect(summary.getByText('MALE')).toHaveCount(0);
  });

  test('importar com IA: campo deixado vazio não renderiza linha no resumo', async ({ page }) => {
    await startImportWithMockedParse(page);

    // Limpa um campo que veio preenchido (Religião) antes de avançar.
    await page.locator('input[name="religion"]').clear();

    await page.getByRole('button', { name: /Próximo: Familiares/ }).click();
    await page.getByRole('button', { name: /Próximo: Resumo/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Resumo da importação' })).toBeVisible();

    const summary = page.locator('div.space-y-5');
    // A linha de Religião não deve existir no resumo (campo vazio = sem linha).
    await expect(summary.getByText('Religião', { exact: true })).toHaveCount(0);
    // Sanidade: outros campos continuam aparecendo.
    await expect(summary.getByText('Ocupação', { exact: true })).toBeVisible();
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
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Modalidade e valor pago vêm pré-preenchidos com o plano (R$700 / Pagamento).
    const modalityField = dialog.locator('div', { has: page.getByText('Modalidade', { exact: true }) }).last();
    const modality = modalityField.locator('select');
    await expect(modality).toBeVisible();
    const amountField = dialog.locator('div', { has: page.getByText('Valor pago (R$)', { exact: true }) }).last();
    const paidAmount = amountField.locator('input[type="number"]');
    await expect(paidAmount).toHaveValue('700');

    // Registra um valor fora do padrão do plano (modalidade Negociado / R$ 250).
    await modality.selectOption('NEGOTIATED');
    await paidAmount.fill('250');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();

    // A parcela passa a exibir o estado "Pago em ..." e o valor efetivamente pago.
    await expect(page.getByText(/Pago em/).first()).toBeVisible();
    await expect(page.getByText('R$ 250').first()).toBeVisible();
  });

  test('aba Contribuição: declara produtos (catálogo + avulso) sem pagamento em dinheiro', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await page.getByRole('button', { name: 'Contribuição' }).click();

    // Garante o carnê gerado (idempotente — o plano default gera parcelas).
    await page.getByRole('button', { name: 'Alterar plano' }).click();
    await expect(page.getByText('Alterar plano de contribuição')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();

    // Abre a declaração numa parcela pendente.
    const payButton = page.getByRole('button', { name: 'Registrar pagamento' }).first();
    await expect(payButton).toBeVisible();
    await payButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Registrar contribuição')).toBeVisible();

    // Desmarca o pagamento em dinheiro → declara SÓ produtos.
    await dialog.getByRole('checkbox', { name: /Registrar pagamento em dinheiro/ }).uncheck();
    await expect(dialog.getByText('Data do pagamento')).toHaveCount(0);

    // Linha do catálogo: item "Arroz (kg)" do seed, quantidade 2.
    await dialog.getByRole('button', { name: /Adicionar produto/ }).click();
    await dialog.getByLabel('Produto do catálogo').selectOption({ label: 'Arroz (kg)' });
    await dialog.getByLabel('Quantidade').fill('2');

    // Linha avulsa: descrição livre "cesta básica".
    await dialog.getByRole('button', { name: /Adicionar produto/ }).click();
    await dialog.getByRole('button', { name: 'Avulso' }).nth(1).click();
    await dialog.getByLabel('Descrição').fill('cesta básica');

    await dialog.getByRole('button', { name: 'Confirmar' }).click();

    // A parcela passa a listar os produtos declarados (seção "Produtos").
    await expect(page.getByText('Produtos', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Arroz').first()).toBeVisible();
    await expect(page.getByText('cesta básica').first()).toBeVisible();
  });
});
