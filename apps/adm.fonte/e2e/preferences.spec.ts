import { test, expect, type Page } from '@playwright/test';
import { login, TEST_ADMIN } from './helpers/auth';
import { resetResidentsFilters } from './helpers/preferences';

// ─────────────────────────────────────────────────────────────────────────────
// E2E dos filtros persistidos por usuário (story 130, exercitada na story 133).
//
// O comportamento de produção já existe: os filtros da lista de Filhos são
// salvos como preferência do usuário (chave `residents.filters`) e reidratados
// no mount da página. Estes testes provam o fluxo ponta-a-ponta com o
// ISOLAMENTO correto — a preferência persiste no DB de teste COMPARTILHADO, então
// cada teste limpa depois de si (`afterEach`), senão vaza para `residents.spec.ts`
// e demais suítes (ex.: escondendo o João Testador do seed).
// ─────────────────────────────────────────────────────────────────────────────

// Segundo usuário do seed de teste — prova que a preferência é POR USUÁRIO.
const TEST_COORD = { email: 'coord@fonte.com', password: 'coord123' };

/** Vai para a lista de Filhos e espera a URL estabilizar. */
async function gotoResidents(page: Page) {
  await page.getByRole('link', { name: 'Filhos' }).click();
  await expect(page).toHaveURL(/\/residents/);
}

/**
 * Muda o status na lista e aguarda a persistência da preferência no DB (o `PUT`
 * é debounced em 500ms). Garante que o próximo passo lê um estado já gravado.
 */
async function setStatusAndPersist(page: Page, status: string) {
  const persisted = page.waitForResponse(
    (res) =>
      res.url().includes('/preferences/residents.filters') &&
      res.request().method() === 'PUT' &&
      res.ok(),
  );
  await page.locator('select').first().selectOption(status);
  await persisted;
}

test.describe('Preferências: filtros persistidos da lista de Filhos', () => {
  // Isolamento (decisão 1): limpa a preferência de AMBOS os usuários que os
  // testes podem tocar, sempre, antes que qualquer outra suíte assuma DB limpo.
  test.afterEach(async () => {
    await resetResidentsFilters(TEST_ADMIN.email, TEST_ADMIN.password);
    await resetResidentsFilters(TEST_COORD.email, TEST_COORD.password);
  });

  test('filtro escolhido é reidratado ao reabrir a lista (sobrevive ao reload)', async ({ page }) => {
    await login(page);
    await gotoResidents(page);

    // Padrão da tela é "Ativo"; o usuário escolhe "Alta" (DISCHARGED).
    await setStatusAndPersist(page, 'DISCHARGED');
    await expect(page).toHaveURL(/status=DISCHARGED/);

    // Recarrega: a URL carrega o filtro e ele permanece.
    await page.reload();
    await expect(page.locator('select').first()).toHaveValue('DISCHARGED');

    // Reabre a lista SEM querystring: a hidratação da preferência salva
    // restaura o filtro mesmo sem pista na URL (é o caminho de hidratação real).
    await page.goto('/residents');
    await expect(page).toHaveURL(/status=DISCHARGED/);
    await expect(page.locator('select').first()).toHaveValue('DISCHARGED');
  });

  test('link com querystring explícita vence a preferência salva', async ({ page }) => {
    await login(page);
    await gotoResidents(page);

    // Salva "Alta" como preferência.
    await setStatusAndPersist(page, 'DISCHARGED');
    await expect(page).toHaveURL(/status=DISCHARGED/);

    // Abre um link explícito para "Ativo": a URL vence a preferência salva
    // (link compartilhado é determinístico — decisão 4/5).
    await page.goto('/residents?status=ACTIVE');
    await expect(page).toHaveURL(/status=ACTIVE/);
    await expect(page).not.toHaveURL(/status=DISCHARGED/);
    await expect(page.locator('select').first()).toHaveValue('ACTIVE');
  });

  test('outro usuário não herda o filtro salvo (preferência é por usuário)', async ({ page }) => {
    // Admin salva "Alta".
    await login(page);
    await gotoResidents(page);
    await setStatusAndPersist(page, 'DISCHARGED');
    await expect(page).toHaveURL(/status=DISCHARGED/);

    // Sai (o logout zera o cache local) e entra como coordenador.
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, TEST_COORD.email, TEST_COORD.password);

    // Coordenador abre a lista: a preferência dele está vazia, então cai no
    // padrão "Ativo" — não herda o "Alta" do admin.
    await gotoResidents(page);
    await expect(page.locator('select').first()).toHaveValue('ACTIVE');
    await expect(page).not.toHaveURL(/status=DISCHARGED/);
  });
});
