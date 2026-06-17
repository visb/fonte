import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Atividades (board Kanban)', () => {
  const ts = () => Date.now();

  async function goto(page: Page) {
    await page.goto('/activities');
    await expect(page).toHaveURL('/activities');
    await expect(page.getByRole('heading', { name: 'Atividades' })).toBeVisible();
  }

  /** Cria uma atividade pelo dialog. Como ADMIN sem casa, nasce em Rascunho. */
  async function createActivity(page: Page, title: string) {
    await page.getByRole('button', { name: 'Nova atividade' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Título *').fill(title);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  }

  /** O card da atividade pelo título. */
  function card(page: Page, title: string) {
    return page.locator('div.rounded-md.border.bg-card').filter({ hasText: title });
  }

  test('ADMIN vê o item Atividades no menu e navega', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Atividades' }).click();
    await expect(page).toHaveURL('/activities');
    await expect(page.getByRole('heading', { name: 'Atividades' })).toBeVisible();
  });

  test('exibe as 6 colunas do board', async ({ page }) => {
    await login(page);
    await goto(page);
    for (const label of [
      'Rascunho',
      'Solicitações',
      'A fazer',
      'Fazendo',
      'Impedimento',
      'Concluídas',
    ]) {
      // O label aparece no cabeçalho da coluna (e pode repetir em badges de card),
      // então basta confirmar ao menos uma ocorrência visível.
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('cria uma atividade (nasce em Rascunho)', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Consertar portão ${ts()}`;
    await createActivity(page, title);
    await expect(card(page, title).getByText('Rascunho')).toBeVisible();
  });

  test('aprova uma solicitação escolhendo o responsável (→ A fazer)', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Pintar muro ${ts()}`;
    await createActivity(page, title);

    // Rascunho → Solicitações (Enviar)
    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await expect(card(page, title).getByText('Solicitações')).toBeVisible();

    // Solicitações → A fazer (Aprovar, escolhe responsável)
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(card(page, title).getByText('A fazer')).toBeVisible();
  });

  test('move um card de A fazer para Fazendo', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Trocar lâmpada ${ts()}`;
    await createActivity(page, title);

    await card(page, title).getByRole('button', { name: 'Enviar' }).click();
    await card(page, title).getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Responsável *').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // A fazer → Fazendo (Iniciar)
    await card(page, title).getByRole('button', { name: 'Iniciar' }).click();
    await expect(card(page, title).getByText('Fazendo')).toBeVisible();
  });
});
