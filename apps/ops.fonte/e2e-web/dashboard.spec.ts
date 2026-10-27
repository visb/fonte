import { test, expect, type Page } from '@playwright/test';

// e2e web do fluxo central: após login, o dashboard do operador carrega os
// dados da casa (stats + ações rápidas). Não cobre fluxos que dependem de API
// nativa (foto/câmera, push, áudio) — esses ficam só no Maestro (e2e/*.yaml).
//
// Exige a API de teste no ar (porta 3001), seed `operator@fonte.com`.

const OPERATOR_EMAIL = 'operator@fonte.com';
const OPERATOR_PASSWORD = 'operator123';

async function loginAsOperator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(OPERATOR_EMAIL);
  await page.getByLabel('input-senha').fill(OPERATOR_PASSWORD);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

/** O expo-router mantém a tela anterior montada: tudo filtrado por visível. */
function visible(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

/**
 * Botão da tab bar. O rótulo da tab e o título do header têm o mesmo texto e a
 * tela anterior continua montada atrás — a barra é o último match do DOM.
 */
function tabButton(page: Page, label: string) {
  return page.getByText(label, { exact: true }).filter({ visible: true }).last();
}

/** A tab "Menu" tomou o lugar da "Perfil" (story 176). */
async function openMenuTab(page: Page) {
  await tabButton(page, 'Menu').click();
  await expect(page.getByTestId('menu-edit-profile')).toBeVisible({ timeout: 15_000 });
}

test.describe('ops.fonte — dashboard web', () => {
  test('dashboard carrega ações rápidas após login', async ({ page }) => {
    await loginAsOperator(page);

    // Ações rápidas renderizadas a partir da casa do operador.
    await expect(page.getByText('Ministérios')).toBeVisible();
    await expect(page.getByText('Atividades')).toBeVisible();
    // Almoxarifado escondido dos atalhos por ora (vai voltar).
    await expect(page.getByText('Almoxarifado')).toHaveCount(0);
  });

  test('logout pelo menu retorna à tela de login', async ({ page }) => {
    await loginAsOperator(page);

    // "Sair" não está mais no cabeçalho do dashboard: mora no fim do menu,
    // junto com o aviso de que sair descarta a fila de envio.
    await openMenuTab(page);
    await expect(page.getByTestId('sync-logout-notice')).toBeVisible();
    await page.getByTestId('menu-item-logout').click();

    await expect(page.getByText('OPS Fonte')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plataforma operacional')).toBeVisible();
  });
});

test.describe('ops.fonte — tab Menu (story 176)', () => {
  test('menu é o índice do app e a tab Perfil não existe mais', async ({ page }) => {
    await loginAsOperator(page);

    // A barra perdeu a tab "Perfil" para a "Menu".
    await expect(page.getByText('Perfil', { exact: true })).toHaveCount(0);

    await openMenuTab(page);

    // Cabeçalho com o usuário logado.
    await expect(visible(page, 'Operador Teste')).toBeVisible();

    // Um item de cada seção leva à sua rota.
    await page.getByTestId('menu-item-residents').click();
    await expect(page).toHaveURL(/\/residents/, { timeout: 15_000 });

    // Estoque e Comunicação escondidos do menu por ora (vão voltar).
    await openMenuTab(page);
    await expect(page.getByTestId('menu-item-storeroom')).toHaveCount(0);
    await expect(page.getByTestId('menu-item-messages')).toHaveCount(0);

    await openMenuTab(page);
    await page.getByTestId('menu-item-sync').click();
    await expect(page).toHaveURL(/\/sync/, { timeout: 15_000 });
  });

  test('editar perfil abre a tela de perfil, que perdeu a tab', async ({ page }) => {
    await loginAsOperator(page);
    await openMenuTab(page);

    await page.getByTestId('menu-edit-profile').click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
    await expect(visible(page, 'Alterar senha')).toBeVisible({ timeout: 15_000 });
  });
});
