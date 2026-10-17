import { test, expect, request as playwrightRequest, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, deleteResident, loginApi } from './helpers/api';

/**
 * Story 211 — rascunho automático do acolhimento (localStorage).
 *
 * Idempotente (story 182): o único filho criado aqui é removido por id no
 * afterAll; o seed não é tocado. O rascunho vive no localStorage do contexto do
 * teste e é limpo no afterEach.
 */

const DRAFT_PREFIX = 'fonte:admission-draft:';
const FAMILIARES = 'Cadastre os familiares do acolhido. Você pode adicioná-los depois, se necessário.';

async function openFirstAdmission(page: Page) {
  await page.getByRole('link', { name: 'Novo acolhimento' }).click();
  await expect(page).toHaveURL('/residents/admission');
  await page.getByRole('link', { name: /Primeiro acolhimento/ }).click();
  await expect(page).toHaveURL('/residents/new');
}

/** Rascunhos gravados no navegador (chave → conteúdo). */
function readDrafts(page: Page) {
  return page.evaluate((prefix) => {
    const out: Record<string, { residentId: string | null; values: Record<string, unknown> }> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out[k] = JSON.parse(localStorage.getItem(k)!);
    }
    return out;
  }, DRAFT_PREFIX);
}

const banner = (page: Page) => page.getByRole('region', { name: 'Rascunho de acolhimento' });

test.describe('Rascunho do acolhimento (story 211)', () => {
  const createdIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate((prefix) => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    }, DRAFT_PREFIX);
  });

  test.afterAll(async () => {
    const api = await playwrightRequest.newContext();
    const token = await loginApi(api);
    for (const id of createdIds) await deleteResident(api, token, id);
    await api.dispose();
  });

  test('ficha parcial sobrevive ao recarregar e é restaurada em Continuar', async ({ page }) => {
    const name = `Rascunho Ficha ${Date.now()}`;
    await openFirstAdmission(page);
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="occupation"]').fill('Pedreiro');
    await expect(page.getByText(/Rascunho salvo às \d{2}:\d{2}/)).toBeVisible();

    await page.reload();
    await page.getByRole('link', { name: 'Filhos' }).click();
    await openFirstAdmission(page);

    await expect(banner(page)).toContainText(name);
    await banner(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('input[name="name"]')).toHaveValue(name);
    await expect(page.locator('input[name="occupation"]')).toHaveValue('Pedreiro');
  });

  test('filho já criado: recarregar e Continuar volta ao passo 3 sem duplicar', async ({ page, request }) => {
    const name = `Rascunho Criado ${Date.now()}`;
    await openFirstAdmission(page);
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole('button', { name: 'Avançar' }).click();
    await page.locator('select[name="houseId"]').selectOption({ label: 'Casa Teste' });
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(page.getByText(FAMILIARES)).toBeVisible();

    const drafts = Object.values(await readDrafts(page));
    expect(drafts).toHaveLength(1);
    const residentId = drafts[0].residentId!;
    expect(residentId).toBeTruthy();
    createdIds.push(residentId);

    await page.reload();
    await expect(banner(page)).toContainText(name);
    await banner(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText(FAMILIARES)).toBeVisible();

    // Voltar e avançar de novo atualiza o mesmo filho (sem POST novo).
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expect(page.getByText(FAMILIARES)).toBeVisible();

    const token = await loginApi(request);
    const res = await request.get(`${API_URL}/residents`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { search: name, limit: 10 },
    });
    expect(res.ok()).toBeTruthy();
    const list = (await res.json()).data as { id: string; name: string }[];
    expect(list.filter((r) => r.name === name).map((r) => r.id)).toEqual([residentId]);

    // Concluir apaga o rascunho.
    await page.getByRole('button', { name: 'Avançar' }).click();
    await page.getByRole('button', { name: 'Concluir acolhimento' }).click();
    await expect(page).toHaveURL(new RegExp(`/residents/${residentId}\\?tab=overview$`));
    expect(await readDrafts(page)).toEqual({});
  });

  test('Descartar apaga o rascunho e abre o wizard vazio', async ({ page }) => {
    const name = `Rascunho Descartado ${Date.now()}`;
    await openFirstAdmission(page);
    await page.locator('input[name="name"]').fill(name);
    await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();

    await page.reload();
    await banner(page).getByRole('button', { name: 'Descartar' }).click();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator('input[name="name"]')).toHaveValue('');
    expect(await readDrafts(page)).toEqual({});
  });
});
