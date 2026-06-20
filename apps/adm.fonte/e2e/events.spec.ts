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
    await page.getByRole('link', { name: 'Eventos' }).click();
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
});
