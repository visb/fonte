import { expect, type Page } from '@playwright/test';

/**
 * Drives the multi-step admission wizard far enough to create the resident.
 * The resident is persisted (status PRE_ADMISSION) when advancing from the
 * "Admissão" step (1) to the "Familiares" step (2). Leaves the page on step 2.
 */
export async function createResidentViaWizard(page: Page, name: string) {
  await page.getByRole('link', { name: 'Novo acolhimento' }).click();
  await expect(page).toHaveURL('/residents/admission');
  await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
  await expect(page).toHaveURL('/residents/new');

  // Step 0 — Ficha de cadastro
  await page.locator('input[name="name"]').fill(name);
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Step 1 — Admissão (entryDate já vem com a data de hoje por padrão)
  await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
  await page.getByRole('button', { name: 'Avançar' }).click();

  // Resident criado → step 2 (Familiares)
  await expect(
    page.getByText('Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.'),
  ).toBeVisible();
}

/** Lista de filhos filtrada pelo nome, com o card correspondente já visível. */
export async function openResidentFromList(page: Page, name: string) {
  await page.getByRole('link', { name: 'Filhos' }).click();
  // Aceita querystring: a lista pode carregar filtros persistidos (story 130).
  await expect(page).toHaveURL(/\/residents(\?|$)/);
  // A listagem abre filtrada por "Ativo" (padrão da tela, story 130). Residentes
  // recém-criados pelo wizard entram como PRE_ADMISSION, então trocamos para
  // "Todos os status" antes de buscar pelo nome.
  await page.locator('select').first().selectOption('');
  await page.getByPlaceholder('Buscar por nome...').fill(name);
  const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: name });
  await expect(card).toBeVisible();
  return card;
}
