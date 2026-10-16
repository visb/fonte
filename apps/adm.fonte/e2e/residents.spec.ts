import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { login } from './helpers/auth';
import { createResidentViaWizard, openResidentFromList } from './helpers/residents';
import { resetResidentsFilters } from './helpers/preferences';
import { fillDate } from './helpers/dates';
import {
  createResident,
  createStoreroomItem,
  deleteResident,
  deleteStoreroomItem,
  API_URL,
  loginApi,
  type ResidentFixture,
  type StoreroomItemFixture,
} from './helpers/api';

test.describe('Filhos (Residentes)', () => {
  test.beforeEach(async ({ page }) => {
    // Vários testes daqui trocam filtros, que a story 130 persiste como
    // preferência no DB compartilhado. Sem zerar antes de cada teste, a
    // hidratação reaplicaria o filtro salvo e a asserção de URL limpa abaixo
    // (e a listagem do João Testador) quebraria. Reset é via API, antes do
    // login — o contexto do teste anterior já fechou, então não há PUT tardio.
    await resetResidentsFilters();
    await login(page);
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page).toHaveURL(/\/residents(\?|$)/);
  });

  // Deixa o DB de teste limpo para as demais suítes (o último teste daqui pode
  // ter gravado um filtro).
  test.afterAll(async () => {
    await resetResidentsFilters();
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

  // ─── Ordenação (story 129) ──────────────────────────────────────────────────

  test('ordenação persiste na URL e sobrevive ao reload', async ({ page }) => {
    const sortSelect = page.getByLabel('Ordenar por');
    // Padrão da tela: mais recentes primeiro.
    await expect(sortSelect).toHaveValue('entry_desc');

    await sortSelect.selectOption('name_asc');
    await expect(page).toHaveURL(/sort=name_asc/);

    // A ordenação veio da URL: recarregar mantém a escolha.
    await page.reload();
    await expect(page).toHaveURL(/sort=name_asc/);
    await expect(page.getByLabel('Ordenar por')).toHaveValue('name_asc');
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

  // ─── Seletor de data (story 201) ─────────────────────────────────────────────
  // O filho nasce pelo wizard (não há como pegar o id antes); a limpeza é por
  // esse id, lido da URL do detalhe, no afterAll (story 182).
  test.describe('seletor de data no acolhimento', () => {
    const createdIds: string[] = [];

    test.afterAll(async () => {
      const api = await playwrightRequest.newContext();
      const token = await loginApi(api);
      for (const id of createdIds) await deleteResident(api, token, id);
      await api.dispose();
    });

    test('calendário abre no foco, troca ano/mês nos dropdowns e a data aparece na ficha', async ({ page }) => {
      const name = `Residente Calendario ${Date.now()}`;
      await page.getByRole('link', { name: 'Novo acolhimento' }).click();
      await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
      await expect(page).toHaveURL('/residents/new');

      // Ficha: nascimento digitado com a máscara.
      await page.locator('input[name="name"]').fill(name);
      await fillDate(page.locator('input[name="birthDate"]'), '1975-08-20');
      await expect(page.locator('input[name="birthDate"]')).toHaveValue('20/08/1975');
      await page.getByRole('button', { name: 'Avançar' }).click();

      // Admissão: entrada escolhida no calendário, aberto pelo foco.
      await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
      const entry = page.locator('input[name="entryDate"]');
      await entry.click();
      const calendar = page.getByRole('dialog').filter({ has: page.getByRole('grid') });
      await expect(calendar).toBeVisible();
      await calendar.getByRole('combobox', { name: 'Escolha o ano' }).selectOption('2025');
      await calendar.getByRole('combobox', { name: 'Escolha o mês' }).selectOption({ label: 'março' });
      await calendar.getByRole('button', { name: /15 de março de 2025/ }).click();
      await expect(calendar).toHaveCount(0);
      await expect(entry).toHaveValue('15/03/2025');
      await page.getByRole('button', { name: 'Avançar' }).click();

      await expect(
        page.getByText('Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Avançar' }).click();
      await page.getByRole('button', { name: 'Concluir acolhimento' }).click();
      await expect(page).toHaveURL(/\/residents\/[^/]+\?tab=overview$/);
      createdIds.push(new URL(page.url()).pathname.split('/').pop()!);

      await expect(page.getByText('15/03/2025').first()).toBeVisible();
    });
  });

  // ─── Nascimento só de maiores de 18 (story 202) ──────────────────────────────
  // Mesma limpeza por id do describe acima: o filho nasce pelo wizard.
  test.describe('maioridade no nascimento', () => {
    const createdIds: string[] = [];
    const MIN_AGE_MESSAGE = 'A pessoa precisa ter pelo menos 18 anos. Confira a data de nascimento.';
    // "Hoje" no fuso da operação, como o backend e o form calculam.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const yearsAgo = (n: number) =>
      `${Number(today.slice(0, 4)) - n}${today.slice(4)}`.replace('-02-29', '-02-28');
    const exactly18 = yearsAgo(18);
    const age17 = yearsAgo(17);

    test.afterAll(async () => {
      const api = await playwrightRequest.newContext();
      const token = await loginApi(api);
      for (const id of createdIds) await deleteResident(api, token, id);
      await api.dispose();
    });

    test('17 anos mostra o erro e não avança; 18 anos completos hoje salva', async ({ page }) => {
      const name = `Residente Maioridade ${Date.now()}`;
      await page.getByRole('link', { name: 'Novo acolhimento' }).click();
      await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
      await expect(page).toHaveURL('/residents/new');

      await page.locator('input[name="name"]').fill(name);
      const birth = page.locator('input[name="birthDate"]');
      await fillDate(birth, age17);
      await page.getByRole('button', { name: 'Avançar' }).click();
      await expect(page.getByText(MIN_AGE_MESSAGE)).toBeVisible();
      await expect(page.locator('select[name="houseId"]')).toHaveCount(0);

      await fillDate(birth, exactly18);
      await page.getByRole('button', { name: 'Avançar' }).click();
      await expect(page.getByText(MIN_AGE_MESSAGE)).toHaveCount(0);
      await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
      await page.getByRole('button', { name: 'Avançar' }).click();
      await expect(
        page.getByText('Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Avançar' }).click();
      await page.getByRole('button', { name: 'Concluir acolhimento' }).click();
      await expect(page).toHaveURL(/\/residents\/[^/]+\?tab=overview$/);
      createdIds.push(new URL(page.url()).pathname.split('/').pop()!);

      const [y, m, d] = exactly18.split('-');
      await expect(page.getByText(`${d}/${m}/${y}`).first()).toBeVisible();
    });
  });

  // ─── Datas de entrada e saída (story 203) ────────────────────────────────────
  // Nada é criado: a entrada futura trava o passo de Admissão antes do POST.
  test('acolhimento com entrada futura mostra o erro e não salva', async ({ page }) => {
    await page.getByRole('link', { name: 'Novo acolhimento' }).click();
    await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
    await expect(page).toHaveURL('/residents/new');

    await page.locator('input[name="name"]').fill(`Residente Entrada Futura ${Date.now()}`);
    await page.getByRole('button', { name: 'Avançar' }).click();
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await fillDate(page.locator('input[name="entryDate"]'), '2999-01-01');
    await page.getByRole('button', { name: 'Avançar' }).click();

    await expect(page.getByText('A data de entrada não pode ser no futuro.')).toBeVisible();
    await expect(
      page.getByText('Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.'),
    ).toHaveCount(0);
    await expect(page).toHaveURL('/residents/new');
  });

  // ─── Navegação e edição ──────────────────────────────────────────────────────

  test('navega para detalhe de residente', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByText('João Testador').first()).toBeVisible();
  });

  // ─── Card responsivo (story 206) ─────────────────────────────────────────────
  // Somente leitura sobre o seed: busca o João Testador e mede o card.

  async function seedCard(page: Page) {
    await page.getByPlaceholder('Buscar por nome...').fill('João Testador');
    const card = page.getByTestId('resident-card').filter({ hasText: 'João Testador' }).first();
    await expect(card).toBeVisible();
    return card;
  }

  test('mobile (390): card em 2 colunas, botões abaixo do nome e sem scroll horizontal', async ({ page }) => {
    const card = await seedCard(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const name = card.getByText('João Testador', { exact: true });
    const actions = card.getByTestId('resident-card-actions');
    await expect(actions).toBeVisible();
    const nameBox = (await name.boundingBox())!;
    const actionsBox = (await actions.boundingBox())!;
    const cardBox = (await card.boundingBox())!;

    // Botões por último: a caixa fica abaixo do nome, não na mesma linha.
    expect(actionsBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    // O card cabe na largura da tela.
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390 + 1);
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    // Editar continua acima do stretched link e navega para a edição.
    await card.getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/residents\/.+\/edit/);
  });

  test('desktop (1280): botões do card na mesma linha do nome', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const card = await seedCard(page);

    const nameBox = (await card.getByText('João Testador', { exact: true }).boundingBox())!;
    const actionsBox = (await card.getByTestId('resident-card-actions').boundingBox())!;
    expect(actionsBox.y).toBeLessThan(nameBox.y + nameBox.height);
    expect(actionsBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
  });

  // Story 197: a ficha do filho não fala em ministério em lugar nenhum — nem na
  // visão geral, nem no formulário de edição.
  test('ficha do filho não mostra ministério', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'João Testador' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);
    await expect(page.getByRole('button', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.getByText('Ministério', { exact: true })).toHaveCount(0);

    const detailUrl = page.url();
    await page.goto(`${detailUrl}/edit`);
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.getByText('Ministério', { exact: true })).toHaveCount(0);
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

    // Volta para lista e abre gateway de novo acolhimento. A URL pode carregar
    // filtros persistidos (story 130 — o helper de busca troca o status).
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page).toHaveURL(/\/residents(\?|$)/);
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

  // Story 182 — estes dois testes MUTAM o carnê (registram pagamento e declaram
  // produto). Fazê-lo no João Testador do seed queimava um recurso compartilhado:
  // num segundo run sem reseed as parcelas já estavam PAID, o botão "Registrar
  // pagamento" não existia mais e os dois falhavam. Agora cada execução cria o
  // próprio filho e o próprio item de catálogo via API e os remove no fim — o
  // seed volta a ser somente leitura para esta parte da suíte.
  test.describe('aba Contribuição', () => {
    let api: APIRequestContext;
    let token: string;
    let resident: ResidentFixture;
    let catalogItem: StoreroomItemFixture;

    test.beforeAll(async () => {
      api = await playwrightRequest.newContext();
      token = await loginApi(api);
      // `entryDate` de hoje + plano pagante ⇒ carnê já materializado com 6
      // competências PENDENTES (uma por teste, com folga).
      resident = await createResident(api, token, { name: `Contribuinte E2E ${Date.now()}` });
      catalogItem = await createStoreroomItem(api, token, {
        name: `Arroz Contribuicao E2E ${Date.now()}`,
        unit: 'kg',
        houseId: resident.houseId,
      });
    });

    test.afterAll(async () => {
      await deleteStoreroomItem(api, token, catalogItem.id);
      await deleteResident(api, token, resident.id);
      await api.dispose();
    });

    /** Abre a aba Contribuição do filho da fixture (buscado pelo nome único). */
    async function openContributionTab(page: Page) {
      const card = await openResidentFromList(page, resident.name);
      await card.first().click();
      await expect(page).toHaveURL(/\/residents\/[0-9a-f-]{36}/);
      await page.getByRole('button', { name: 'Contribuição' }).click();
    }

    test('define plano e registra pagamento de parcela', async ({ page }) => {
      await openContributionTab(page);

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

    test('declara produtos (catálogo + avulso) sem pagamento em dinheiro', async ({ page }) => {
      await openContributionTab(page);

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

      // Linha do catálogo: o item DA FIXTURE (não o "Arroz (kg)" do seed, que
      // outra suíte poderia ter removido), quantidade 2.
      await dialog.getByRole('button', { name: /Adicionar produto/ }).click();
      await dialog.getByLabel('Produto do catálogo').selectOption({ label: catalogItem.label });
      await dialog.getByLabel('Quantidade').fill('2');

      // Linha avulsa: descrição livre "cesta básica".
      await dialog.getByRole('button', { name: /Adicionar produto/ }).click();
      await dialog.getByRole('button', { name: 'Avulso' }).nth(1).click();
      await dialog.getByLabel('Descrição').fill('cesta básica');

      await dialog.getByRole('button', { name: 'Confirmar' }).click();

      // A parcela passa a listar os produtos declarados (seção "Produtos").
      await expect(page.getByText('Produtos', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(catalogItem.name).first()).toBeVisible();
      await expect(page.getByText('cesta básica').first()).toBeVisible();
    });
  });

  // Story 164: filho com 2 acolhimentos (Marcelo Reacolhido, do seed).
  test('aba Contribuição: abre no acolhimento atual e o seletor troca o carnê', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome...').fill('Marcelo Reacolhido');
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Marcelo Reacolhido' }).first().click();
    await expect(page).toHaveURL(/\/residents\/.+/);

    await page.getByRole('button', { name: 'Contribuição' }).click();

    // Com dois acolhimentos o seletor aparece e abre no vigente.
    const selector = page.getByLabel('Acolhimento');
    await expect(selector).toBeVisible();
    await expect(selector.locator('option:checked')).toContainText('(atual)');

    // O carnê do acolhimento atual não traz as competências pagas do antigo.
    await expect(page.getByRole('button', { name: 'Registrar pagamento' }).first()).toBeVisible();
    await expect(page.getByText('Acolhimento encerrado — somente leitura')).toHaveCount(0);

    // Troca para o acolhimento anterior: 6 parcelas pagas, tudo somente leitura.
    await selector.selectOption({ index: 1 });
    await expect(page.getByText('Acolhimento encerrado — somente leitura')).toBeVisible();
    await expect(page.getByText(/Pago em/)).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Registrar pagamento' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Alterar plano' })).toHaveCount(0);
  });

  // Story 196/200 — baixa pela LISTA, com saída da comunidade e transferência
  // como itens separados do `⋮`. Fixtures próprias (os testes MUTAM status/casa),
  // criadas via API e removidas por id no afterAll; o seed continua somente
  // leitura (story 182).
  test.describe('saída da comunidade e transferência pela lista', () => {
    let api: APIRequestContext;
    let token: string;
    let resident: ResidentFixture;
    let transferred: ResidentFixture;
    let lateEntry: ResidentFixture;
    let targetHouse: { id: string; name: string };

    test.beforeAll(async () => {
      api = await playwrightRequest.newContext();
      token = await loginApi(api);
      const stamp = Date.now();
      // Entrada antiga: a alta abaixo (23/06/2026) não pode ser anterior a ela
      // (story 203).
      resident = await createResident(api, token, {
        name: `Baixa Lista E2E ${stamp}`,
        status: 'ACTIVE',
        entryDate: '2026-01-10',
      });
      lateEntry = await createResident(api, token, {
        name: `Baixa Datas E2E ${stamp}`,
        status: 'ACTIVE',
        entryDate: '2026-03-10',
      });
      transferred = await createResident(api, token, {
        name: `Transferencia Lista E2E ${stamp}`,
        status: 'ACTIVE',
      });
      // O seed tem uma casa só: a de destino é fixture desta suíte.
      const houseName = `Casa Destino E2E ${stamp}`;
      const houseRes = await api.post(`${API_URL}/houses`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: houseName },
      });
      if (!houseRes.ok()) {
        throw new Error(`Falha ao criar casa (${houseRes.status()}): ${await houseRes.text()}`);
      }
      targetHouse = { id: (await houseRes.json()).id as string, name: houseName };
    });

    test.afterAll(async () => {
      await deleteResident(api, token, resident.id);
      await deleteResident(api, token, transferred.id);
      await deleteResident(api, token, lateEntry.id);
      await api.delete(`${API_URL}/houses/${targetHouse.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await api.dispose();
    });

    async function openMenuOf(page: Page, name: string) {
      await page.getByPlaceholder('Buscar por nome...').fill(name);
      const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
      await expect(card).toBeVisible();
      // A busca é debounced (400ms) e refaz a listagem: esperar a lista conter
      // SÓ a fixture garante que o card não será remontado com o menu aberto
      // (o item do menu se soltaria do DOM no meio do clique).
      await expect(page.locator('.rounded-lg.border.bg-card')).toHaveCount(1);
      await card.getByRole('button', { name: `Ações de ${name}` }).click();
      return card;
    }

    test('⋮ → Transferir de casa → o filho aparece na casa de destino', async ({ page }) => {
      const card = await openMenuOf(page, transferred.name);
      await expect(page.getByRole('menuitem', { name: 'Remover da casa' })).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Transferir de casa' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Transferir de casa')).toBeVisible();
      await expect(dialog.getByText('O que aconteceu?')).toHaveCount(0);
      await dialog.locator('select').selectOption({ label: targetHouse.name });
      await dialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(dialog).toHaveCount(0);

      // Segue ativo (transferência não é saída), agora na casa de destino.
      await expect(card).toContainText(targetHouse.name);
      await page.locator('select').nth(1).selectOption(targetHouse.id);
      await expect(
        page.locator('.rounded-lg.border.bg-card').filter({ hasText: transferred.name }),
      ).toBeVisible();
    });

    test('⋮ → Declarar saída da comunidade → alta tira o filho dos ativos e o mostra como Alta', async ({ page }) => {
      const card = await openMenuOf(page, resident.name);
      await page.getByRole('menuitem', { name: 'Declarar saída da comunidade' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Declarar saída da comunidade')).toBeVisible();
      await expect(dialog.getByRole('option', { name: 'Transferir para outra casa' })).toHaveCount(0);
      await fillDate(dialog.getByPlaceholder('dd/mm/aaaa'), '2026-06-23');
      await dialog.getByRole('button', { name: 'Confirmar' }).click();

      // Listagem de ativos (filtro padrão da tela): o card sai.
      await expect(card).toHaveCount(0);

      // No filtro "Alta" ele reaparece, com o badge do status novo.
      await page.locator('select').first().selectOption('DISCHARGED');
      const discharged = page
        .locator('.rounded-lg.border.bg-card')
        .filter({ hasText: resident.name });
      await expect(discharged).toBeVisible();
      await expect(discharged.getByText('Alta')).toBeVisible();
    });

    // Story 203: a saída não pode ser anterior à entrada do filho.
    test('⋮ → alta com data anterior à entrada mostra o erro e não salva', async ({ page }) => {
      const card = await openMenuOf(page, lateEntry.name);
      await page.getByRole('menuitem', { name: 'Declarar saída da comunidade' }).click();

      const dialog = page.getByRole('dialog');
      await fillDate(dialog.getByPlaceholder('dd/mm/aaaa'), '2026-03-09');
      await dialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(
        dialog.getByText('A data de saída não pode ser anterior à data de entrada (10/03/2026).'),
      ).toBeVisible();

      await dialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(dialog).toHaveCount(0);
      // Continua ativo: o card segue na listagem de ativos.
      await expect(card).toBeVisible();
    });
  });
});
