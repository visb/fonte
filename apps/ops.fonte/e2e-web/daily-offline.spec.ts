import { test, expect, type Page } from '@playwright/test';

// Story 225 (decisão 11) — a Daily EXIGE rede. Com o board aberto, cair a rede
// mostra o aviso e desabilita "Aplicar" (e arrasto/toque); a rede voltando
// recarrega o board e as ações voltam.
//
// Somente leitura sobre o seed: abrir a daily cria/usa a sessão de rascunho da
// "Casa Teste" (tabela `daily_sessions`, que o seed não popula); nada é movido
// nem aplicado. Exige a API de teste no ar (porta 3001) e `coord@fonte.com`.

const COORDINATOR = { email: 'coord@fonte.com', password: 'coord123' };

async function loginAsCoordinator(page: Page) {
  await page.goto('/');
  await page.getByLabel('input-email').fill(COORDINATOR.email);
  await page.getByLabel('input-senha').fill(COORDINATOR.password);
  await page.getByText('Entrar', { exact: true }).click();
  await expect(page.getByText('Bem-vindo,')).toBeVisible({ timeout: 30_000 });
}

test.describe('ops.fonte — Daily sem rede (story 225)', () => {
  test('sem rede: aviso e ações desabilitadas; rede de volta: board recarrega', async ({ page, context }) => {
    await loginAsCoordinator(page);
    await page.getByText('Menu', { exact: true }).last().click();
    await page.getByText('Daily', { exact: true }).click();

    await expect(page.getByText('Sem ministério', { exact: true })).toBeVisible({ timeout: 30_000 });
    const apply = page.getByTestId('daily-apply');
    await expect(apply).toBeVisible();
    await expect(apply).not.toHaveAttribute('aria-disabled', 'true');

    // ── sem rede ────────────────────────────────────────────────────────────
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/A daily precisa de conexão/)).toBeVisible();
    await expect(apply).toHaveAttribute('aria-disabled', 'true');
    // Toque num card não abre o "Mover para…".
    await page.getByLabel('João Testador').click();
    await expect(page.getByText('Mover para…')).toHaveCount(0);

    // ── rede de volta ───────────────────────────────────────────────────────
    const reload = page.waitForResponse((res) => res.url().includes('/daily/current'), { timeout: 30_000 });
    await context.setOffline(false);
    await reload;
    await expect(page.getByText(/A daily precisa de conexão/)).toHaveCount(0, { timeout: 15_000 });
    await expect(apply).not.toHaveAttribute('aria-disabled', 'true');
  });
});
