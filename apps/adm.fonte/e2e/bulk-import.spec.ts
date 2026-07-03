import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

// Import em lote (story 104). O parse real da planilha e das fichas `.docx`
// depende do backend + IA (Anthropic), indisponível/instável no ambiente de
// teste — então interceptamos as três rotas do fluxo (mesmo padrão do E2E de
// import unitário, que já mocka `parse-docx`). O objetivo aqui é a orquestração
// do front: subir planilha → arrastar fichas → fila processa → cards `ready`
// com dados inline → badge de conflito.

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
    resident: { name, cpf, entryDate: '2023-02-10', exitDate: null },
    relatives: [],
    warnings: name.includes('Duplicado') ? { rg: 'RG ilegível' } : {},
    houseName: 'Casa Teste',
    rawText: 'ficha',
    photoBase64: null,
    matchedHouseName: 'Casa Teste',
    contributionMonths: [],
    matchStatus: 'matched',
  };
}

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
}

test.describe('Import em lote de filhos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await mockImportRoutes(page);
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

    // 3. Ambos os cards concluem a extração (status "Pronto") com os dados inline.
    await expect(page.getByText('Filho Tranquilo')).toBeVisible();
    await expect(page.getByText('Filho Duplicado')).toBeVisible();
    await expect(page.getByText('Pronto')).toHaveCount(2);
    // data de entrada e casa aparecem inline
    await expect(page.getByText('Entrada: 10/02/2023').first()).toBeVisible();
    await expect(page.getByText('Casa Teste').first()).toBeVisible();

    // 4. O item com conflito exibe o alerta; o outro, "Sem alertas".
    await expect(page.getByText(/Conflito: Filho Já Cadastrado/)).toBeVisible();
    await expect(page.getByText('Sem alertas')).toBeVisible();

    // 5. Os botões Aprovar/Ver ficha estão presentes (ação completa é da 105).
    await expect(page.getByRole('button', { name: 'Aprovar' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver ficha' }).first()).toBeVisible();
  });
});
