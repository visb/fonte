import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Servos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Servos' }).click();
    await expect(page).toHaveURL('/staff');
  });

  test('lista servos existentes', async ({ page }) => {
    // Coordenador criado pelo seed
    await expect(page.getByText('Coordenador Teste')).toBeVisible();
  });

  test('mostra avatar na listagem de servos', async ({ page }) => {
    const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Coordenador Teste' });
    // Avatar circular visível (foto ou ícone fallback) — o badge de papel também usa
    // rounded-full, então alvejamos o container do avatar pelo tamanho fixo.
    await expect(card.locator('.w-10.h-10.rounded-full')).toBeVisible();
  });

  // Story 96 — o cadastro é em abas e só a 1ª (Sistema) tem obrigatórios:
  // criar preenchendo apenas a aba Sistema deve funcionar.
  test('cria novo servo preenchendo só a aba Sistema e aparece na lista', async ({ page }) => {
    const name = `Servo E2E ${Date.now()}`;
    const email = `servo_e2e_${Date.now()}@fonte.com`;

    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await expect(page).toHaveURL('/staff/new');

    // As três abas do form estão presentes; Sistema é a ativa.
    await expect(page.getByRole('tab', { name: 'Sistema' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pessoal' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Endereço e contato' })).toBeVisible();

    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByPlaceholder('exemplo@email.com').fill(email);
    await page.getByLabel('Função *').selectOption('COORDINATOR');
    // Serve na casa (padrão)
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page).toHaveURL('/staff');
    await expect(page.getByText(name)).toBeVisible();
  });

  test('edita servo existente', async ({ page }) => {
    // Cria servo próprio para não afetar "Coordenador Teste" usado em outros testes
    const name = `Servo Para Editar ${Date.now()}`;
    const email = `editar_${Date.now()}@fonte.com`;
    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByPlaceholder('exemplo@email.com').fill(email);
    await page.getByLabel('Função *').selectOption('COORDINATOR');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/staff\/.+\/edit/);
    await page.getByPlaceholder('Nome completo').clear();
    await page.getByPlaceholder('Nome completo').fill(`${name} (Editado)`);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/staff');
    await expect(page.getByText(`${name} (Editado)`)).toBeVisible();
  });

  // Story 96 — as abas Pessoal e Endereço/Contato são opcionais, mas os valores
  // preenchidos nelas devem ser salvos e aparecer na ficha do servo.
  test('edita servo preenchendo as abas opcionais Pessoal e Endereço', async ({ page }) => {
    const stamp = Date.now();
    const name = `Servo Abas ${stamp}`;
    const occupation = `Ocupação E2E ${stamp}`;
    const city = `Cidade E2E ${stamp}`;

    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByLabel('Função *').selectOption('SERVANT');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/staff\/.+\/edit/);

    await page.getByRole('tab', { name: 'Pessoal' }).click();
    await page.getByPlaceholder('Profissão ou ocupação').fill(occupation);
    await page.getByRole('tab', { name: 'Endereço e contato' }).click();
    await page.getByPlaceholder('Ex: São Paulo').fill(city);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page).toHaveURL('/staff');

    // Ficha do servo mostra os valores das abas opcionais.
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByText(name).click();
    await expect(page.getByText(occupation)).toBeVisible();
    await expect(page.getByText(city)).toBeVisible();
  });

  test('abre diálogo de resetar senha', async ({ page }) => {
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'Coordenador Teste' }).getByTitle('Resetar senha').click();
    // Verifica que o dialog de reset abriu
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('exclui servo e some da lista', async ({ page }) => {
    // Cria servo para excluir
    const name = `Servo Para Excluir ${Date.now()}`;
    const email = `excluir_${Date.now()}@fonte.com`;

    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByPlaceholder('exemplo@email.com').fill(email);
    await page.getByLabel('Função *').selectOption('SERVANT');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(name)).not.toBeVisible();
  });

  // ─── Regressão story-12: select mantém valor quando opções carregam tarde ────

  test('editar servo com casa preenche o campo Casa mesmo com /houses lento', async ({ page }) => {
    // Cria servo vinculado a uma casa.
    const name = `Servo Casa Tardia ${Date.now()}`;
    const email = `casa_tardia_${Date.now()}@fonte.com`;
    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByPlaceholder('exemplo@email.com').fill(email);
    await page.getByLabel('Função *').selectOption('SERVANT');
    await page.getByLabel('Casa *').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Abre a edição e captura a URL do servo.
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/staff\/.+\/edit/);
    const editUrl = page.url();

    // Força a corrida: atrasa GET /houses para chegar DEPOIS do servo. O reload
    // limpa o cache do react-query, então as casas vêm da rede (lentas) enquanto
    // GET /staff/:id chega rápido. Sem o fix, o <select> nativo descarta o
    // houseId aplicado pelo reset() porque ainda não há <option> da casa.
    await page.route('**/api/v1/houses', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(editUrl);

    // O campo Casa deve exibir a casa do servo, não vazio.
    await expect(page.getByLabel('Casa *')).toHaveValue(/.+/);
    await expect(page.getByLabel('Casa *')).toContainText('Casa Teste');
  });

  test('editar servo de grupo preenche o campo Grupo de Apoio mesmo com /support-groups lento', async ({ page }) => {
    // Cria um grupo de apoio para vincular.
    const groupName = `Grupo Servo ${Date.now()}`;
    await page.getByRole('link', { name: 'Grupos de Apoio' }).click();
    await page.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByLabel('Nome *').fill(groupName);
    await page.getByLabel('Nome da Igreja *').fill('Igreja Teste');
    await page.getByLabel('Endereço *').fill('Rua Teste, 100');
    await page.getByLabel('Dia da semana *').selectOption('6');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(groupName)).toBeVisible();

    // Cria servo vinculado a esse grupo.
    const name = `Servo Grupo Tardio ${Date.now()}`;
    const email = `grupo_tardio_${Date.now()}@fonte.com`;
    await page.getByRole('link', { name: 'Servos' }).click();
    await page.getByRole('link', { name: 'Novo Servo' }).click();
    await page.getByPlaceholder('Nome completo').fill(name);
    await page.getByPlaceholder('exemplo@email.com').fill(email);
    await page.getByLabel('Função *').selectOption('SERVANT');
    await page.getByRole('button', { name: 'Serve no Grupo de Apoio' }).click();
    await page.getByLabel('Grupo de Apoio *').selectOption({ label: groupName });
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Abre a edição e captura a URL.
    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: name }).getByTitle('Editar').click();
    await expect(page).toHaveURL(/\/staff\/.+\/edit/);
    const editUrl = page.url();

    // Atrasa GET /support-groups para chegar depois do servo (reload limpa cache).
    await page.route('**/api/v1/support-groups', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(editUrl);

    // O campo Grupo deve exibir o grupo do servo, não vazio.
    await expect(page.getByLabel('Grupo de Apoio *')).toHaveValue(/.+/);
    await expect(page.getByLabel('Grupo de Apoio *')).toContainText(groupName);
  });

  // ─── Página de detalhe (ficha do servo) ──────────────────────────────────────

  test('abre página de detalhe do servo com aba Visão Geral e ações', async ({ page }) => {
    await page
      .locator('.rounded-lg.border.bg-card')
      .filter({ hasText: 'Coordenador Teste' })
      .getByText('Coordenador Teste')
      .click();

    await expect(page).toHaveURL(/\/staff\/.+/);
    await expect(page.getByRole('heading', { name: 'Coordenador Teste' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resetar senha' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();

    // Story 96 — a ficha do servo não exibe mais campos clínicos/de tratamento.
    await expect(page.getByText('Dependência química')).not.toBeVisible();
    await expect(page.getByText('Problemas de saúde')).not.toBeVisible();
    await expect(page.getByText('Medicação contínua')).not.toBeVisible();
    await expect(page.getByText('Peso', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Altura', { exact: true })).not.toBeVisible();
  });
});
