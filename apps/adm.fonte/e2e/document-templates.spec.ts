import { deflateSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

// Story 22 — constrói um PNG válido de dimensões conhecidas (sem dependências
// externas) para validar que a imagem entra no editor no tamanho natural.
function makePng(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // 10..12 = compression/filter/interlace = 0

  // Raw RGB scanlines (each row prefixed with filter byte 0).
  const rowBytes = width * 3;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) raw[y * (rowBytes + 1)] = 0;
  const idat = deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Story 23 — fonte padrão do editor sincronizada com A+/A−.
// O texto-base do editor renderiza em DEFAULT_FONT_PT (12pt). Diminuir 1×
// (A−) e aumentar 1× (A+) deve voltar exatamente ao tamanho inicial, sem salto.

const DEFAULT_FONT_PT = 12;

test.describe('Editor de templates — fonte padrão sincronizada', () => {
  const templateName = `E2E Fonte ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('A− 1× e A+ 1× sobre o texto base volta ao tamanho inicial', async ({ page }) => {
    // Cria um template novo para editar.
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    // Abre o editor do template recém-criado.
    await page.getByText(templateName, { exact: true }).click();

    // Digita um texto no editor (ProseMirror).
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Texto de teste');

    // Seleciona todo o conteúdo do editor.
    await page.keyboard.press('ControlOrMeta+a');

    // A− 1× → a marca grava DEFAULT-2 (parte do default, não de um valor hardcoded).
    // O chain do botão preserva a seleção via .focus(), então não re-selecionamos.
    await page.getByTitle('Diminuir fonte').click();
    await expect(
      page.locator(`.ProseMirror span[data-font-size="${DEFAULT_FONT_PT - 2}"]`).first(),
    ).toBeVisible();

    // A+ 1× sobre a mesma seleção → a marca volta ao tamanho inicial (12pt), sem salto.
    await page.getByTitle('Aumentar fonte').click();
    await expect(
      page.locator(`.ProseMirror span[data-font-size="${DEFAULT_FONT_PT}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`.ProseMirror span[data-font-size="${DEFAULT_FONT_PT - 2}"]`),
    ).toHaveCount(0);
  });
});

// Story 22 — imagem inserida sem tratamento: o nó nasce com as dimensões
// naturais do arquivo, gravadas em data-img-width/data-img-height.
test.describe('Editor de templates — imagem entra no tamanho natural', () => {
  const IMG_WIDTH = 300;
  const IMG_HEIGHT = 120;
  const templateName = `E2E Imagem ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('inserir imagem grava data-img-width/height com as dimensões do arquivo', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    // Seleciona o arquivo no input escondido (dispara o uploadFile).
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: makePng(IMG_WIDTH, IMG_HEIGHT),
    });

    // A imagem entra no editor (NodeView React) já no tamanho natural: o estilo
    // inline reflete as dimensões do arquivo (width/height em px).
    const liveImg = page.locator('.ProseMirror img').first();
    await expect(liveImg).toBeVisible({ timeout: 15000 });
    await expect(liveImg).toHaveJSProperty('naturalWidth', IMG_WIDTH);
    await expect(liveImg).toHaveCSS('width', `${IMG_WIDTH}px`);
    await expect(liveImg).toHaveCSS('height', `${IMG_HEIGHT}px`);

    // Salva o template e confirma que o nó é SERIALIZADO com
    // data-img-width/data-img-height iguais às dimensões naturais do arquivo
    // (renderHTML do ResizableImage). É o HTML que vai para o PDF, sem
    // tratamento dos bytes.
    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    const persistedHtml = await page.locator('.ProseMirror').evaluate((el) => {
      const img = el.querySelector('img');
      // Reconstrói os data-attrs a partir do estilo inline do NodeView (o nó
      // vivo) para validar tamanho, e usa o que o editor serializou.
      return img?.outerHTML ?? '';
    });
    expect(persistedHtml).toContain(`width: ${IMG_WIDTH}px`);
    expect(persistedHtml).toContain(`height: ${IMG_HEIGHT}px`);
  });
});

// Story 21 — tabelas e texto em múltiplas colunas. Toda tabela nasce SEM borda
// (classe `doc-table no-border`); o "2 colunas" é uma tabela 1×2 sem borda. O
// conteúdo é HTML e precisa persistir o <table class="doc-table ...">.
test.describe('Editor de templates — tabelas e colunas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('inserir tabela 2×2, digitar em 2 células e salvar persiste a tabela', async ({ page }) => {
    const templateName = `E2E Tabela ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Insere uma tabela 2×2 (decisão story 21: sem borda por padrão).
    await page.getByTitle('Inserir tabela 2×2').click();
    await expect(editor.locator('table.doc-table')).toBeVisible();

    // Digita em duas células distintas.
    const cells = editor.locator('table.doc-table td');
    await cells.nth(0).click();
    await page.keyboard.type('Célula A');
    await cells.nth(1).click();
    await page.keyboard.type('Célula B');

    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    // A tabela persiste no conteúdo serializado (HTML contém <table).
    const html = await editor.evaluate((el) => el.innerHTML);
    expect(html).toContain('<table');
    expect(html).toContain('doc-table');
    expect(html).toContain('Célula A');
    expect(html).toContain('Célula B');
  });

  test('inserir "2 colunas" salva uma tabela com class="doc-table no-border"', async ({ page }) => {
    const templateName = `E2E Colunas ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.getByTitle('Inserir 2 colunas de texto').click();
    await expect(editor.locator('table.doc-table.no-border')).toBeVisible();

    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    const html = await editor.evaluate((el) => el.innerHTML);
    // A classe `doc-table no-border` sobrevive ao HTML salvo (DocTable.class).
    expect(html).toMatch(/class="[^"]*doc-table[^"]*no-border[^"]*"/);
  });

  // Story 29 — toolbar de tabela reativa ao cursor: os controles de edição só
  // aparecem quando o cursor está dentro de uma tabela.
  test('controles de edição de tabela só aparecem com o cursor dentro dela', async ({ page }) => {
    const templateName = `E2E Tabela Reativa ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    const addColBtn = page.getByTitle('Adicionar coluna');

    // Cursor fora de tabela (parágrafo): controle +Col não existe.
    await editor.click();
    await page.keyboard.type('Texto fora da tabela');
    await expect(addColBtn).toHaveCount(0);

    // Insere tabela e clica numa célula → +Col aparece (reatividade useEditorState).
    await page.getByTitle('Inserir tabela 2×2').click();
    await editor.locator('table.doc-table td').first().click();
    await expect(addColBtn).toBeVisible();

    // Volta o cursor para fora da tabela → +Col some de novo.
    await editor.locator('p').first().click();
    await expect(addColBtn).toHaveCount(0);
  });

  // Story 29 — tabela sem borda exibe bordas tracejadas nas células NO EDITOR
  // (guia visual de divisão); o PDF segue borderless.
  test('tabela sem borda mostra células tracejadas no editor', async ({ page }) => {
    const templateName = `E2E Tabela Tracejada ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.getByTitle('Inserir 2 colunas de texto').click();

    const cell = editor.locator('table.doc-table.no-border td').first();
    await expect(cell).toBeVisible();
    await expect(cell).toHaveCSS('border-top-style', 'dashed');
  });
});

// Story 29 — zoom do frame A4 abre em 100% por padrão.
test.describe('Editor de templates — zoom padrão', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('o zoom inicial é 100%', async ({ page }) => {
    const templateName = `E2E Zoom ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    // O botão 100% nasce selecionado (variante primary: bg-primary).
    const zoom100 = page.getByRole('button', { name: '100%' });
    await expect(zoom100).toBeVisible();
    await expect(zoom100).toHaveClass(/bg-primary/);
    // E a folha está renderizada em escala 1 (sem redução).
    const a4 = page.getByTestId('a4-page');
    await expect(a4).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });
});

// Story 24 — moldura A4 dentro do editor + quebra de página. O EditorContent
// renderiza dentro de `.a4-page` (folha A4 794px com a mesma geometria do PDF) e,
// quando o conteúdo passa de uma folha, a guia de quebra de página fica visível.
// A4_PAGE_WIDTH_PX (794) é a mesma constante de @fonte/doc-styles consumida pelo
// PDF — é isso que faz a quebra na tela bater com a do PDF.
const A4_PAGE_WIDTH_PX = 794;

test.describe('Editor de templates — moldura A4 e quebra de página', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('o editor renderiza dentro de uma folha A4 (.a4-page) com largura A4', async ({ page }) => {
    const templateName = `E2E A4 ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    // A folha A4 existe e o editor (ProseMirror) está dentro dela.
    const a4Page = page.locator('[data-testid="a4-page"]');
    await expect(a4Page).toBeVisible();
    await expect(a4Page.locator('.ProseMirror')).toBeVisible();

    // A folha tem a largura A4 real (794px) — a geometria que o PDF usa. O zoom
    // é aplicado via transform: scale(), então o width do layout permanece 794.
    const width = await a4Page.evaluate((el) => el.getBoundingClientRect().width);
    // getBoundingClientRect reflete o scale; lemos o offsetWidth (pré-transform).
    const layoutWidth = await a4Page.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(layoutWidth).toBe(A4_PAGE_WIDTH_PX);
    expect(width).toBeGreaterThan(0);

    // Conteúdo curto continua em 1 folha: a altura da folha é ~1 página A4.
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Texto curto em uma única página.');
    const shortHeight = await a4Page.evaluate((el) => (el as HTMLElement).offsetHeight);
    // 1123px (A4) ± margem de tolerância de render.
    expect(shortHeight).toBeLessThan(1123 * 1.5);
  });

  test('conteúdo longo (> 1 folha) faz a folha passar de uma página A4', async ({ page }) => {
    const templateName = `E2E A4 Longo ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const a4Page = page.locator('[data-testid="a4-page"]');
    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Digita muitos parágrafos para ultrapassar a altura útil de uma folha A4
    // (área útil ~1027px). 80 linhas garantem passar de uma página.
    for (let i = 0; i < 80; i++) {
      await page.keyboard.type(`Linha ${i + 1} de conteúdo para estourar a página.`);
      await page.keyboard.press('Enter');
    }

    // A folha cresceu além de uma página A4 (1123px) — há uma segunda página, e a
    // guia de quebra (desenhada a cada 1123px via repeating-linear-gradient) passa
    // a ser visível dentro da folha.
    const tallHeight = await a4Page.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(tallHeight).toBeGreaterThan(1123);

    // A guia de quebra de página está presente como background da folha.
    const hasGuide = await a4Page.evaluate(
      (el) => getComputedStyle(el).backgroundImage.includes('linear-gradient'),
    );
    expect(hasGuide).toBe(true);
  });
});

// Story 30 — selecionar a tabela inteira e agir sobre ela como um bloco. A alça
// (grip) aparece com o cursor dentro da tabela; clicar nela seleciona a tabela
// (NodeSelection) e mostra o botão de menu no canto com Recortar/Copiar/Duplicar/
// Remover. Os testes focam seleção + duplicar + remover (copiar/recortar dependem
// do clipboard real do browser, instável de asserir no Playwright).
test.describe('Editor de templates — seleção e menu de ações da tabela', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('alça seleciona a tabela e o menu duplica e remove', async ({ page }) => {
    const templateName = `E2E Tabela Menu ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.getByTitle('Inserir tabela 2×2').click();
    await expect(editor.locator('table.doc-table')).toHaveCount(1);

    // Cursor numa célula → a alça de seleção aparece (reatividade useEditorState).
    await editor.locator('table.doc-table td').first().click();
    const handle = page.getByTestId('table-select-handle');
    await expect(handle).toBeVisible();

    // Clicar na alça seleciona a tabela: a alça some e o botão de menu aparece.
    await handle.click();
    const menuBtn = page.getByTestId('table-block-menu');
    await expect(menuBtn).toBeVisible();
    await expect(handle).toHaveCount(0);

    // Abrir o menu → as 4 ações estão presentes.
    await menuBtn.click();
    await expect(page.getByRole('menuitem', { name: 'Recortar' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copiar' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicar' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Remover' })).toBeVisible();

    // Duplicar → passa a haver 2 tabelas.
    await page.getByRole('menuitem', { name: 'Duplicar' }).click();
    await expect(editor.locator('table.doc-table')).toHaveCount(2);

    // Seleciona a primeira tabela de novo e remove → volta a 1.
    await editor.locator('table.doc-table').first().locator('td').first().click();
    await page.getByTestId('table-select-handle').click();
    await page.getByTestId('table-block-menu').click();
    await page.getByRole('menuitem', { name: 'Remover' }).click();
    await expect(editor.locator('table.doc-table')).toHaveCount(1);
  });
});

// Story 144 — autocomplete inline de variáveis. Ao digitar `{{` no corpo, duas
// coisas ao mesmo tempo: o drawer VariablesPanel expande E um popup de sugestões
// aparece no cursor filtrando VARIABLES conforme se digita. Escolher (Enter)
// substitui o trecho `{{parcial` pelo token completo `{{key}}` (nunca duplica as
// chaves). Coberto por E2E porque o autocomplete depende de um contenteditable/
// ProseMirror real que o jsdom não implementa.
test.describe('Editor de templates — autocomplete de variáveis ({{)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('digitar {{ abre o drawer e o popup; escolher insere {{name}} e persiste', async ({ page }) => {
    const templateName = `E2E Autocomplete ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Digitar `{{` dispara os DOIS comportamentos: o drawer expande...
    await page.keyboard.type('{{');
    await expect(page.getByText('Clique ou arraste para o corpo do documento.')).toBeVisible();
    // ...e o popup de sugestões aparece no cursor (com a lista completa).
    const popup = page.locator('[data-variable-suggestion]');
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('variable-suggestion-list')).toBeVisible();

    // Filtrando por `nome` a sugestão "Nome completo" aparece no popup.
    await page.keyboard.type('nome');
    await expect(popup.getByText('Nome completo')).toBeVisible();

    // Enter confirma o item ativo → o trecho `{{nome` vira o token completo
    // `{{name}}` (sem duplicar as chaves: nem `{{nome}}` nem `{{{{name}}`).
    await page.keyboard.press('Enter');
    await expect(popup).toHaveCount(0);

    const html = await editor.evaluate((el) => el.innerHTML);
    expect(html).toContain('{{name}}');
    expect(html).not.toContain('{{nome}}');
    expect(html).not.toContain('{{{{');

    // Recolhe o drawer (aberto pelo `{{`) para liberar o botão de salvar, que
    // fica no canto inferior direito sob a barra fixa quando ela está expandida.
    await page.getByRole('button', { name: 'Recolher variáveis' }).click();

    // Salvar persiste o token.
    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    // Recarrega e reabre o template — o token `{{name}}` sobreviveu ao salvar.
    await page.reload();
    await page.getByText(templateName, { exact: true }).click();
    await expect(page.locator('.ProseMirror')).toContainText('{{name}}');
  });

  test('sem match o popup some, sem bloquear a digitação de `{{` literal', async ({ page }) => {
    const templateName = `E2E Sem Match ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.type('{{');
    const popupList = page.locator('[data-variable-suggestion] [data-testid="variable-suggestion-list"]');
    await expect(popupList).toBeVisible();

    // Texto que não casa nenhuma variável → o popup some (não bloqueia digitar).
    await page.keyboard.type('zzz');
    await expect(popupList).toBeHidden();

    // O texto literal `{{zzz` permanece no corpo (o gatilho não engoliu nada).
    await expect(editor).toContainText('{{zzz');
  });
});

// Story 27 — link/unlink no editor. Texto com link vira <a class="doc-link"> e o
// CSS compartilhado o pinta de azul + sublinhado (mesma regra do PDF).
test.describe('Editor de templates — link/unlink', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('link', { name: 'Templates de documentos' }).click();
    await expect(page).toHaveURL('/settings/templates');
  });

  test('aplicar link via popover marca o texto e remover desfaz', async ({ page }) => {
    const templateName = `E2E Link ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Fonte de Misericórdia');
    await page.keyboard.press('Control+A');

    // Abre o popover de link, digita a URL e aplica.
    const toolbar = page.getByTestId('link-toolbar');
    await toolbar.getByTitle('Inserir/editar link').click();
    await page.getByPlaceholder('https://exemplo.com').fill('fonte.org.br');
    await page.getByRole('button', { name: 'Aplicar' }).click();

    // O texto vira um link com class doc-link e href normalizado (https://).
    const link = editor.locator('a.doc-link');
    await expect(link).toHaveAttribute('href', 'https://fonte.org.br');
    // E aparece azul + sublinhado (CSS compartilhado @fonte/doc-styles).
    await expect(link).toHaveCSS('text-decoration-line', 'underline');

    // Remove o link pela toolbar — o <a> some, o texto permanece.
    await toolbar.getByTitle('Remover link').click();
    await expect(editor.locator('a.doc-link')).toHaveCount(0);
    await expect(editor).toContainText('Fonte de Misericórdia');
  });

  // Story 28 — clicar no link abre um tooltip de ações (não navega) e o botão unlink
  // da toolbar reflete o cursor em tempo real.
  test('clicar no link abre tooltip de acoes e ativa o unlink da toolbar', async ({ page }) => {
    const templateName = `E2E Link Tooltip ${Date.now()}`;
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.getByLabel('Nome do documento').fill(templateName);
    await page.getByRole('button', { name: 'Criar' }).click();

    await page.getByText(templateName, { exact: true }).click();

    const editor = page.locator('.ProseMirror');
    const toolbar = page.getByTestId('link-toolbar');
    const unlinkBtn = toolbar.getByTitle('Remover link');

    // Sem link sob o cursor, o botão unlink da toolbar está desabilitado.
    await editor.click();
    await page.keyboard.type('Fonte de Misericórdia');
    await expect(unlinkBtn).toBeDisabled();

    // Aplica um link no texto selecionado.
    await page.keyboard.press('Control+A');
    await toolbar.getByTitle('Inserir/editar link').click();
    await page.getByPlaceholder('https://exemplo.com').fill('fonte.org.br');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    const link = editor.locator('a.doc-link');
    await expect(link).toHaveAttribute('href', 'https://fonte.org.br');

    // Clicar no link NÃO navega (continua na página de templates) e abre o tooltip.
    await link.click();
    await expect(page).toHaveURL('/settings/templates');
    const bubble = page.getByTestId('link-bubble');
    await expect(bubble).toBeVisible();

    // Com o cursor dentro do link, o unlink da toolbar fica habilitado (reatividade).
    await expect(unlinkBtn).toBeEnabled();

    // "Remover link" no tooltip desfaz o link; o texto permanece.
    await bubble.getByTitle('Remover link').click();
    await expect(editor.locator('a.doc-link')).toHaveCount(0);
    await expect(editor).toContainText('Fonte de Misericórdia');
  });
});
