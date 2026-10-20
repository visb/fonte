import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { ADMISSION_HISTORY_MESSAGES } from '@fonte/types';
import { login } from './helpers/auth';
import { createResident, deleteResident, loginApi, type ResidentFixture } from './helpers/api';
import { fillDate, isoToBr } from './helpers/dates';

// Story 215 — ADMIN cria e edita passagens na aba Histórico. Fixture própria
// (filho criado via API, removido no afterAll — story 182); nada do seed muda.

let api: APIRequestContext;
let token: string;
let resident: ResidentFixture;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  resident = await createResident(api, token, {
    name: `E2E Historico ${Date.now()}`,
    entryDate: '2025-01-10',
    status: 'ACTIVE',
    familyInvestment: 'SOCIAL',
  });
});

test.afterAll(async () => {
  await deleteResident(api, token, resident.id);
  await api.dispose();
});

async function openHistory(page: Page) {
  await page.goto(`/residents/${resident.id}?tab=admissions`);
  await expect(page.getByRole('button', { name: /Adicionar acolhimento/ })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('dialog').filter({ hasText: /acolhimento/i });

async function fillPassage(page: Page, entry: string, exit: string) {
  const modal = dialog(page);
  await modal.getByLabel('Casa').selectOption({ label: 'Casa Teste' });
  // Sem Tab na entrada: o foco cairia na saída, que abre o próprio calendário.
  // Preencher a saída fecha o popover da entrada; o Tab final sai para o Status.
  await modal.locator('#admission-entry-date').fill(isoToBr(entry));
  await fillDate(modal.locator('#admission-exit-date'), exit);
  await modal.getByLabel('Status').selectOption('DISCHARGED');
}

test.describe.serial('Histórico — acolhimentos (story 215)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ADMIN adiciona passagem antiga e edita a saída', async ({ page }) => {
    await openHistory(page);
    await page.getByRole('button', { name: /Adicionar acolhimento/ }).click();
    await fillPassage(page, '2022-03-01', '2022-09-01');
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog(page)).toHaveCount(0);

    const cards = page.getByTestId('admission-card');
    await expect(cards).toHaveCount(2);
    const oldCard = cards.filter({ hasText: 'Acolhimento 1' });
    await expect(oldCard).toContainText('01/03/2022');
    await expect(oldCard).toContainText('01/09/2022');

    await oldCard.getByRole('button', { name: 'Editar acolhimento' }).click();
    await fillDate(dialog(page).locator('#admission-exit-date'), '2022-10-15');
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(oldCard).toContainText('15/10/2022');
  });

  test('passagem sobreposta mostra o erro e não salva', async ({ page }) => {
    await openHistory(page);
    await page.getByRole('button', { name: /Adicionar acolhimento/ }).click();
    await fillPassage(page, '2022-05-01', '2022-12-01');
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(
      dialog(page).getByText(ADMISSION_HISTORY_MESSAGES.overlap('2022-03-01', '2022-10-15')),
    ).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('admission-card')).toHaveCount(2);
  });
});
