import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Eventos (timeline)', () => {
  const ts = () => Date.now();

  function dtLocal(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  }

  const inDays = (days: number) => dtLocal(new Date(Date.now() + days * 86_400_000));

  async function goto(page: Page) {
    await page.goto('/eventos');
    await expect(page).toHaveURL('/eventos');
    await expect(page.getByRole('heading', { name: 'Eventos' })).toBeVisible();
  }

  async function createEvent(page: Page, title: string, startLocal: string) {
    await page.getByRole('button', { name: 'Novo evento' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Título *').fill(title);
    await page.getByLabel('Descrição *').fill('Descrição do evento');
    await page.getByLabel('Início *').fill(startLocal);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  }

  function item(page: Page, title: string) {
    return page.locator('[data-testid="event-item"]').filter({ hasText: title });
  }

  test('ADMIN vê o item Eventos no menu e navega', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Eventos', exact: true }).click();
    await expect(page).toHaveURL('/eventos');
    await expect(page.getByRole('heading', { name: 'Eventos' })).toBeVisible();
  });

  test('cria um evento e ele aparece na timeline', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Retiro ${ts()}`;
    await createEvent(page, title, inDays(40));
    await expect(item(page, title)).toBeVisible();
  });

  test('os 3 próximos eventos vêm destacados', async ({ page }) => {
    await login(page);
    await goto(page);
    // Garante ao menos 3 eventos futuros; o destaque é limitado a 3.
    await createEvent(page, `Proximo A ${ts()}`, inDays(1));
    await createEvent(page, `Proximo B ${ts()}`, inDays(2));
    await createEvent(page, `Proximo C ${ts()}`, inDays(3));

    const highlighted = page.locator('[data-testid="event-item"][data-highlighted="true"]');
    await expect(highlighted).toHaveCount(3);
  });

  test('um evento passado aparece opaco', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Passado ${ts()}`;
    await createEvent(page, title, inDays(-10));
    await expect(item(page, title)).toHaveAttribute('data-past', 'true');
    await expect(item(page, title)).toHaveAttribute('data-highlighted', 'false');
  });

  test('edita um evento', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Editar ${ts()}`;
    await createEvent(page, title, inDays(50));

    await item(page, title).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const newTitle = `${title} editado`;
    await page.getByLabel('Título *').fill(newTitle);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(newTitle)).toBeVisible();
  });

  test('evento nasce só-divulgação e o toggle habilita a inscrição', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Toggle ${ts()}`;
    await createEvent(page, title, inDays(45));

    // Default: só-divulgação (story 67).
    await expect(
      item(page, title).getByTestId('registration-badge'),
    ).toHaveText('Só divulgação');

    // Edita e liga a inscrição.
    await item(page, title).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Campo de vagas começa desabilitado quando inscrição off.
    await expect(page.getByLabel('Vagas')).toBeDisabled();
    await page.getByTestId('registration-enabled').check();
    await expect(page.getByLabel('Vagas')).toBeEnabled();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(
      item(page, title).getByTestId('registration-badge'),
    ).toHaveText('Inscrição aberta');
  });

  test('adiciona campos custom de inscrição e abre a lista de inscritos (story 68)', async ({
    page,
  }) => {
    await login(page);
    await goto(page);
    const title = `Campos ${ts()}`;
    await createEvent(page, title, inDays(48));

    // Edita, liga inscrição e adiciona um campo select com opções.
    await item(page, title).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('registration-enabled').check();

    await page.getByTestId('add-registration-field').click();
    const row = page.getByTestId('registration-field-row').first();
    await expect(row).toBeVisible();
    await row.getByLabel('Rótulo *').fill('Tamanho da camiseta');
    await row.getByLabel('Tipo').selectOption('select');
    // Campo de opções aparece só para select/multi_select.
    await row.getByLabel('Opções (uma por linha)').fill('P\nM\nG');

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // O botão "Inscritos" aparece (inscrição habilitada) e abre o dialog.
    await item(page, title).getByTestId('view-registrations').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Nenhuma inscrição ainda.')).toBeVisible();
  });

  test('remove um evento', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Remover ${ts()}`;
    await createEvent(page, title, inDays(60));

    await item(page, title).getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(item(page, title)).toHaveCount(0);
  });

  // ── Eventos internos (story 94) ─────────────────────────────────────────────

  async function createInternalEvent(page: Page, title: string, startLocal: string) {
    await page.getByRole('button', { name: 'Novo evento' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Título *').fill(title);
    await page.getByLabel('Descrição *').fill('Evento para servos');
    await page.getByLabel('Início *').fill(startLocal);
    await page.getByTestId('event-audience').selectOption('INTERNAL');
    // Ao marcar Interno, a seção de inscrição some.
    await expect(page.getByTestId('registration-enabled')).toHaveCount(0);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }

  test('cria evento interno: badge "Interno" na timeline, não no portal', async ({
    page,
  }) => {
    await login(page);
    await goto(page);
    const title = `Interno ${ts()}`;
    await createInternalEvent(page, title, inDays(35));

    // Na timeline de gestão, o item ganha o badge "Interno".
    await expect(item(page, title).getByTestId('audience-badge')).toHaveText('Interno');

    // Evento interno não tem inscrição: a página pública de gestão não o lista
    // como inscritível (badge "Interno", sem botão Inscritos na timeline).
    await goto(page);
    await expect(item(page, title).getByTestId('view-registrations')).toHaveCount(0);
  });

  // Story 95: convite via WhatsApp aos servos. Sem credencial Meta no ambiente
  // de teste, os envios caem em "pulado" (best-effort) — o fluxo e o resumo são
  // exercitados sem chamar nenhum serviço externo.
  test('convida servos por WhatsApp e vê o resumo enviados/pulados', async ({ page }) => {
    await login(page);
    await goto(page);
    const title = `Convite ${ts()}`;
    await createEvent(page, title, inDays(30));

    await item(page, title).getByTestId('invite-staff').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Convidar servos — ${title}`)).toBeVisible();

    // Seleciona todos os servos e dispara.
    await expect(dialog.getByTestId('invite-staff-row').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Selecionar todos' }).click();
    await dialog.getByRole('button', { name: /Enviar convites \(\d+\)/ }).click();

    // Resumo do lote: sem credencial Meta, tudo cai em pulado (falha no envio).
    await expect(dialog.getByTestId('invite-summary')).toBeVisible();
    await expect(dialog.getByTestId('invite-summary')).toContainText('pulado(s).');

    await dialog.getByTestId('invite-close').click();
    await expect(dialog).not.toBeVisible();
  });
});
