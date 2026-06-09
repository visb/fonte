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
});
