import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

// ─────────────────────────────────────────────────────────────────────────────
// E2E da tela /observabilidade (story 192).
//
// ISOLAMENTO (story 182): esta suíte NÃO cria nem apaga linha em banco nenhum.
// O único efeito colateral é o "Zerar contadores", que zera um store EM MEMÓRIA
// da API de teste (story 191) — nada persiste, nada some do seed. Por isso não
// há `afterAll` de cleanup: não é limpeza faltando.
//
// O contador da própria rota volta a subir logo depois do reset porque o poll
// de 10s da tela é, ele mesmo, uma requisição medida.
// ─────────────────────────────────────────────────────────────────────────────

const observabilityLink = (page: Page) =>
  page.getByRole('link', { name: 'Observabilidade' });

const statsRow = (page: Page) =>
  page.getByRole('row', { name: /observability\/stats/ }).first();

/**
 * Contagem de chamadas da rota de stats na tabela de custo por rota. Logo após
 * o reset a linha some da tabela (o agregado voltou a zero e a rota ainda não
 * foi recontada) — ausência é 0, não erro.
 */
async function statsCallCount(page: Page): Promise<number> {
  const row = statsRow(page);
  if ((await row.count()) === 0) return 0;
  const text = await row.locator('td').nth(1).innerText();
  return Number(text.trim()) || 0;
}

test.describe('Observabilidade', () => {
  test('ADMIN abre a tela pelo link do menu e vê as rotas que acabou de gerar', async ({
    page,
  }) => {
    await login(page);
    await observabilityLink(page).click();
    await expect(page).toHaveURL('/observabilidade');
    await expect(page.getByRole('heading', { name: 'Observabilidade' })).toBeVisible();

    // Aviso permanente de volatilidade.
    await expect(page.getByText(/desde o último restart da API/)).toBeVisible();
    await expect(page.getByText(/Agregado desde/)).toBeVisible();

    // Runtime.
    await expect(page.getByText('Event loop lag (p99)')).toBeVisible();
    await expect(page.getByText('Memória (RSS)')).toBeVisible();
    await expect(page.getByText('Uptime')).toBeVisible();

    // A tabela mostra a rota que a própria navegação acabou de gerar: o login
    // já terminou antes do carregamento da tela, então aparece na 1ª leitura.
    await expect(page.getByRole('heading', { name: 'Custo por rota' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /auth\/login/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Últimas requisições' })).toBeVisible();

    // A rota /observability/stats só entra no agregado DEPOIS que a própria
    // resposta fecha — ou seja, ela aparece no poll seguinte (10s). É a prova
    // de que a tela é viva e se mede a si mesma.
    await expect(
      page.getByRole('cell', { name: /observability\/stats/ }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('ordena a tabela por CPU médio ao clicar no cabeçalho', async ({ page }) => {
    await login(page);
    await page.goto('/observabilidade');
    await expect(page.getByRole('heading', { name: 'Custo por rota' })).toBeVisible();

    await page.getByRole('button', { name: 'Ordenar por CPU médio' }).click();
    // O cabeçalho ativo ganha o indicador de direção; a tabela continua de pé.
    await expect(page.getByRole('button', { name: 'Ordenar por CPU médio' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /auth\/login/ }).first()).toBeVisible();
  });

  test('Zerar contadores derruba a contagem da rota observada', async ({ page }) => {
    await login(page);
    await page.goto('/observabilidade');
    await expect(page.getByRole('heading', { name: 'Custo por rota' })).toBeVisible();

    // Força algumas chamadas para a contagem ficar claramente acima de 1.
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Custo por rota' })).toBeVisible();
    }
    await expect(statsRow(page)).toBeVisible({ timeout: 20_000 });
    const before = await statsCallCount(page);
    expect(before).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Zerar contadores' }).click();

    // Depois do reset a contagem cai (o refetch da invalidação já reconta a
    // própria chamada, então o alvo é "menor que antes", não "zero").
    await expect
      .poll(async () => statsCallCount(page), { timeout: 15_000 })
      .toBeLessThan(before);
  });

  // SERVANT não é usado aqui de propósito: no adm.fonte esse perfil sequer
  // autentica (ProtectedRoute/LoginPage barram antes de qualquer rota). O
  // recorte de "não-ADMIN logado" é o COORDINATOR.
  test('não-admin (coordinator) não vê o link e é barrado na URL direta', async ({
    page,
  }) => {
    await login(page, 'coord@fonte.com', 'coord123');
    await expect(observabilityLink(page)).toHaveCount(0);

    await page.goto('/observabilidade');
    await expect(page.getByRole('heading', { name: 'Observabilidade' })).toHaveCount(0);
  });

  test('SERVANT não entra no adm e portanto não alcança a tela', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('operator@fonte.com');
    await page.getByLabel('Senha', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Acesso não permitido para este perfil.')).toBeVisible();

    await page.goto('/observabilidade');
    await expect(page).toHaveURL(/\/login/);
  });
});
