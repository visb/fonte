import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

// Import em lote (story 104 + abas da story 109). O parse real da planilha e das
// fichas `.docx` depende do backend + IA (Anthropic), indisponível/instável no
// ambiente de teste — então interceptamos as três rotas do fluxo (mesmo padrão
// do E2E de import unitário, que já mocka `parse-docx`). O objetivo aqui é a
// orquestração do front: subir planilha → arrastar fichas → fila processa →
// cards migram entre as abas (Fila → Processadas → Aprovadas/Canceladas).

const SPREADSHEET_ROWS = {
  rows: [
    {
      houseName: 'Casa Teste',
      name: 'Filho Tranquilo',
      nameNormalized: 'filho tranquilo',
      cpf: '11111111111',
      familyContact: '(11) 90000-0001',
      entryDate: '2023-02-10',
      exitDate: null,
      contributionMonths: [],
    },
  ],
  houses: ['Casa Teste'],
  skipped: 0,
  ignoredSheets: ['curso biblico'],
};

function previewFor(name: string, cpf: string) {
  return {
    resident: { name, cpf, entryDate: '2023-02-10', exitDate: null, familyInvestment: 'SOCIAL' },
    relatives: [{ name: 'Mãe do Filho', phone: '(11) 90000-0000', relationship: 'Mãe' }],
    warnings: name.includes('Duplicado') ? { rg: 'RG ilegível' } : {},
    houseName: 'Casa Teste',
    rawText: 'ficha',
    photoBase64: null,
    matchedHouseName: 'Casa Teste',
    contributionMonths: ['2023-02-01', '2023-03-01'],
    matchStatus: 'matched',
  };
}

// Guarda o último payload enviado ao commit — o teste de persistência assevera
// o corpo (parse é mockado, sem Anthropic; ver comentário no describe da 105).
const commits: Array<Record<string, unknown>> = [];

async function mockImportRoutes(page: Page) {
  await page.route('**/api/v1/residents/import/parse-spreadsheet', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(SPREADSHEET_ROWS) }),
  );

  let call = 0;
  await page.route('**/api/v1/residents/import/parse-docx-with-spreadsheet', (route) => {
    const preview =
      call++ === 0
        ? previewFor('Filho Tranquilo', '11111111111')
        : previewFor('Filho Duplicado', '22222222222');
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(preview) });
  });

  await page.route('**/api/v1/residents/import/check-conflict**', (route) => {
    const name = new URL(route.request().url()).searchParams.get('name') ?? '';
    const conflicts = name.includes('Duplicado')
      ? [{ id: 'r9', name: 'Filho Já Cadastrado', cpf: '22222222222', status: 'ACTIVE', houseName: 'Casa Teste' }]
      : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conflicts }) });
  });

  // A casa da planilha ("Casa Teste") não é garantida no seed do banco de teste;
  // para o auto-match resolver o `houseId` de forma determinística, servimos a
  // lista de casas com ela. (story 105)
  await page.route('**/api/v1/houses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'house-teste', name: 'Casa Teste' }]),
    }),
  );

  // O commit é interceptado (não real): o parse é mockado, então a ficha não
  // corresponde a dados reais do seed. O teste assevera o payload persistido.
  await page.route('**/api/v1/residents/import/commit', async (route) => {
    commits.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        resident: { id: 'new-resident' },
        contributionsCreated: { created: 2, skipped: 0 },
      }),
    });
  });
}

test.describe('Import em lote de filhos', () => {
  test.beforeEach(async ({ page }) => {
    commits.length = 0;
    // Registra as rotas ANTES do login: a lista de casas é buscada já no
    // dashboard e o React Query a cacheia — sem o mock prévio o auto-match do
    // modal usaria as casas reais do seed. (story 105)
    await mockImportRoutes(page);
    await login(page);
    await page.getByRole('link', { name: 'Filhos' }).click();
    await expect(page).toHaveURL('/residents');
  });

  test('botão "Importar em lote" leva à tela e a dropzone de fichas começa desabilitada', async ({ page }) => {
    await page.getByRole('link', { name: 'Importar em lote' }).click();
    await expect(page).toHaveURL('/residents/import-lote');
    await expect(page.getByRole('heading', { name: 'Importar filhos em lote' })).toBeVisible();
    await expect(
      page.getByText('Carregue a planilha de referência antes de adicionar as fichas.'),
    ).toBeVisible();
    // fila vazia
    await expect(page.getByText('Arraste as fichas .docx para começar')).toBeVisible();
  });

  test('upload da planilha + fichas: cards processam, ficam prontos com dados inline e conflito', async ({ page }) => {
    await page.getByRole('link', { name: 'Importar em lote' }).click();
    await expect(page).toHaveURL('/residents/import-lote');

    // 1. Planilha de referência.
    await page.locator('input[accept*="spreadsheetml"]').setInputFiles({
      name: 'lista-filhos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('planilha de referencia'),
    });
    await expect(page.getByText('Planilha carregada')).toBeVisible();

    // 2. Arrasta 2 fichas `.docx` (input múltiplo já habilitado).
    await page.locator('input[multiple]').setInputFiles([
      {
        name: 'ficha-1.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 1'),
      },
      {
        name: 'ficha-2.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 2'),
      },
    ]);

    // 3. Concluída a extração, os itens migram da Fila para a aba Processadas.
    await page.getByRole('tab', { name: 'Processadas' }).click();
    await expect(page.getByText('Filho Tranquilo')).toBeVisible();
    await expect(page.getByText('Filho Duplicado')).toBeVisible();
    await expect(page.getByText('Pronto')).toHaveCount(2);
    // data de entrada e casa aparecem inline
    await expect(page.getByText('Entrada: 10/02/2023').first()).toBeVisible();
    await expect(page.getByText('Casa Teste').first()).toBeVisible();

    // 4. O item com conflito exibe o alerta; o outro, "Sem alertas".
    await expect(page.getByText(/Conflito: Filho Já Cadastrado/)).toBeVisible();
    await expect(page.getByText('Sem alertas')).toBeVisible();

    // 4b. A contagem de alertas do card em conflito abre um popover com o
    //     detalhe campo → mensagem (story 107).
    const duplicadoCard = page.getByTestId('import-item-card').filter({ hasText: 'Filho Duplicado' });
    await expect(page.getByText(/precisam de revisão manual/)).toBeHidden();
    await duplicadoCard.getByRole('button', { name: /1 alerta/ }).click();
    await expect(page.getByText(/precisam de revisão manual/)).toBeVisible();
    await expect(page.getByText('RG:')).toBeVisible();
    await expect(page.getByText('RG ilegível')).toBeVisible();

    // 5. Os botões Aprovar/Ver ficha estão presentes (ação completa é da 105).
    await expect(page.getByRole('button', { name: 'Aprovar' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver ficha' }).first()).toBeVisible();
  });

  // Fecha o E2E ponta-a-ponta do epic (story 100). O parse (planilha + fichas)
  // é mockado por falta de Anthropic no ambiente de teste; o commit também é
  // interceptado porque a ficha mockada não bate com dados reais do seed — o
  // teste assevera o payload persistido e a transição do card para "Importado".
  test('modal da ficha: editar campo, aprovar → payload persistido e card importado; conflito bloqueia', async ({ page }) => {
    await page.getByRole('link', { name: 'Importar em lote' }).click();
    await expect(page).toHaveURL('/residents/import-lote');

    await page.locator('input[accept*="spreadsheetml"]').setInputFiles({
      name: 'lista-filhos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('planilha de referencia'),
    });
    await expect(page.getByText('Planilha carregada')).toBeVisible();

    await page.locator('input[multiple]').setInputFiles([
      {
        name: 'ficha-1.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 1'),
      },
      {
        name: 'ficha-2.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 2'),
      },
    ]);
    // Extração concluída: os itens estão na aba Processadas.
    await page.getByRole('tab', { name: 'Processadas' }).click();
    await expect(page.getByText('Pronto')).toHaveCount(2);

    // Card em conflito: alerta visível e Aprovar desabilitado.
    const duplicadoCard = page.getByTestId('import-item-card').filter({ hasText: 'Filho Duplicado' });
    await expect(page.getByText(/Conflito: Filho Já Cadastrado/)).toBeVisible();
    await expect(duplicadoCard.getByRole('button', { name: 'Aprovar' })).toBeDisabled();

    // Abre o modal do item limpo, edita o nome e aprova.
    const tranquiloCard = page.getByTestId('import-item-card').filter({ hasText: 'Filho Tranquilo' });
    await tranquiloCard.getByRole('button', { name: 'Ver ficha' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal.getByText('Ficha do filho')).toBeVisible();
    const nameInput = modal.getByPlaceholder('Nome do acolhido');
    await expect(nameInput).toHaveValue('Filho Tranquilo');

    // story 108: histórico de contribuição read-only vindo da planilha.
    const history = modal.getByRole('list', { name: 'Histórico de contribuição' });
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await expect(history).toContainText('Fevereiro/2023');
    await expect(history).toContainText('Março/2023');

    await nameInput.fill('Filho Tranquilo Editado');

    await modal.getByRole('button', { name: 'Aprovar' }).click();

    // Modal fecha e o card aprovado migra para a aba Aprovadas.
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('tab', { name: 'Aprovadas' }).click();
    await expect(page.getByText('Importado')).toBeVisible();
    // O card mantém o nome extraído no preview (a edição só viaja no payload).
    await expect(page.getByText('Filho Tranquilo')).toBeVisible();

    // Persistência: o payload do commit leva o nome editado, a casa resolvida,
    // o familiar e as contribuições retroativas da planilha.
    expect(commits).toHaveLength(1);
    const payload = commits[0] as {
      resident: { name: string; houseId: string };
      relatives: unknown[];
      contributionMonths: string[];
    };
    expect(payload.resident.name).toBe('Filho Tranquilo Editado');
    expect(payload.resident.houseId).toBe('house-teste');
    expect(payload.relatives).toHaveLength(1);
    expect(payload.contributionMonths).toEqual(['2023-02-01', '2023-03-01']);

    // O item com conflito segue bloqueado para aprovação direta (na aba Processadas).
    await page.getByRole('tab', { name: 'Processadas' }).click();
    await expect(duplicadoCard.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  // story 109: as fichas migram entre as abas conforme o estágio. Cancelar não
  // apaga — move para Canceladas e permite Restaurar de volta a Processadas.
  test('abas: cancelar move para Canceladas e Restaurar devolve para Processadas', async ({ page }) => {
    await page.getByRole('link', { name: 'Importar em lote' }).click();
    await expect(page).toHaveURL('/residents/import-lote');

    await page.locator('input[accept*="spreadsheetml"]').setInputFiles({
      name: 'lista-filhos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('planilha de referencia'),
    });
    await expect(page.getByText('Planilha carregada')).toBeVisible();

    await page.locator('input[multiple]').setInputFiles([
      {
        name: 'ficha-1.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 1'),
      },
      {
        name: 'ficha-2.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('ficha 2'),
      },
    ]);

    // Extraídas → aba Processadas com os dois cards.
    await page.getByRole('tab', { name: 'Processadas' }).click();
    await expect(page.getByText('Pronto')).toHaveCount(2);

    // Cancela o "Filho Duplicado": some de Processadas e aparece em Canceladas.
    const duplicadoCard = page.getByTestId('import-item-card').filter({ hasText: 'Filho Duplicado' });
    await duplicadoCard.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Pronto')).toHaveCount(1);
    await expect(page.getByText('Filho Duplicado')).toBeHidden();

    await page.getByRole('tab', { name: 'Canceladas' }).click();
    await expect(page.getByText('Filho Duplicado')).toBeVisible();
    await expect(page.getByText('Cancelado')).toBeVisible();
    const canceladoCard = page.getByTestId('import-item-card').filter({ hasText: 'Filho Duplicado' });
    // No estado cancelado só há Restaurar (sem Aprovar/Ver ficha).
    await expect(canceladoCard.getByRole('button', { name: 'Aprovar' })).toBeHidden();

    // Restaura: volta para Processadas com preview (status "Pronto").
    await canceladoCard.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByText('Filho Duplicado')).toBeHidden();

    await page.getByRole('tab', { name: 'Processadas' }).click();
    await expect(page.getByText('Pronto')).toHaveCount(2);
    await expect(page.getByText('Filho Duplicado')).toBeVisible();
  });
});
