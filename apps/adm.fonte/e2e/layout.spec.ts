import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

// ─────────────────────────────────────────────────────────────────────────────
// E2E do layout da sidebar (story 158).
//
// Em janelas baixas, a lista de links do adm.fonte estourava a viewport e
// empurrava o rodapé (Meu Perfil / Sair) para fora da tela. Agora só a <nav>
// rola: header e rodapé ficam fixos. O ADMIN é o pior caso — vê todos os links
// e, com Faturamento e Configurações expandidos, passa de 20 linhas.
//
// Estes testes são somente de leitura: não criam, alteram nem apagam dados no
// banco de teste compartilhado.
// ─────────────────────────────────────────────────────────────────────────────

/** Altura baixa o bastante para estourar a lista com os submenus abertos. */
const SHORT_VIEWPORT = { width: 1280, height: 600 };

const sidebarNav = (page: Page) => page.locator('aside nav');
const exitButton = (page: Page) => page.getByRole('button', { name: 'Sair' });

async function expandSubmenus(page: Page) {
  await page.getByRole('button', { name: /Faturamento/ }).click();
  await expect(page.getByRole('link', { name: 'Pizza' })).toBeVisible();

  await page.getByRole('button', { name: /Configurações/ }).click();
  await expect(page.getByRole('link', { name: 'Templates de documentos' })).toBeVisible();
}

test.describe('Layout: sidebar com scroll próprio', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await login(page);
    await expandSubmenus(page);
  });

  test('rodapé (Meu Perfil / Sair) fica visível sem rolar a página', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Meu Perfil' })).toBeVisible();
    await expect(exitButton(page)).toBeVisible();

    // "Visível" de verdade: o rodapé cabe dentro da viewport, sem depender de
    // scroll do documento.
    const box = await exitButton(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(SHORT_VIEWPORT.height);
  });

  test('documento não ganha scroll vertical', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        htmlOverflow: html.scrollHeight - html.clientHeight,
        bodyOverflow: document.body.scrollHeight - document.body.clientHeight,
      };
    });

    // Tolerância de 1px para arredondamento de layout.
    expect(overflow.htmlOverflow).toBeLessThanOrEqual(1);
    expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
  });

  test('o excedente da lista vai para o scroll interno da <nav>', async ({ page }) => {
    const metrics = await sidebarNav(page).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));

    expect(metrics.overflowY).toBe('auto');
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });

  test('rolar a lista de links não move o rodapé', async ({ page }) => {
    const before = await exitButton(page).boundingBox();
    expect(before).not.toBeNull();

    const scrollTop = await sidebarNav(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    // A lista realmente rolou por dentro.
    expect(scrollTop).toBeGreaterThan(0);

    // O último item da lista aparece após rolar...
    await expect(page.getByRole('link', { name: 'Backup' })).toBeVisible();

    // ...e o rodapé continua exatamente onde estava.
    const after = await exitButton(page).boundingBox();
    expect(after).not.toBeNull();
    expect(Math.round(after!.y)).toBe(Math.round(before!.y));
    await expect(exitButton(page)).toBeVisible();
  });

  test('logout continua funcionando a partir do rodapé fixo', async ({ page }) => {
    await exitButton(page).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
