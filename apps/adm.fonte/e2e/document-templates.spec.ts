import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

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
