import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { createTemplate, deleteTemplate, loginApi, type TemplateFixture } from './helpers/api';
import { resetResidentsFilters } from './helpers/preferences';
import { openResidentFromList } from './helpers/residents';

// Aba de anexos do filho — cobre as stories 152 (PDF combinado), 160
// (disponibilidade do template por status) e 161 (barra sempre visível +
// checkbox de cabeçalho + seleção limpa após o sucesso).
//
// Os templates vêm de uma FIXTURE POR SPEC, criada e removida via API: um
// template obrigatório permanente no seed global travaria o wizard de
// acolhimento (`admissionGate.allRequiredDocsSigned`) e quebraria
// `residents.spec.ts`, `dashboard.spec.ts` e `bible-courses.spec.ts`. Como o
// Playwright roda com `workers: 1` e `fullyParallel: false`, a fixture de
// arquivo é isolada das demais suítes.
//
// O conteúdo dos templates é HTML puro, SEM nenhuma variável `{{...}}`, de
// propósito: assim os dois pré-voos da geração (assinatura do staff, story 128,
// e campos faltantes do filho) não disparam e o caso do PDF combinado testa o
// caminho que interessa, sem relaxar asserção nem pular teste.

const RESIDENT_NAME = 'João Testador'; // filho ACTIVE do seed

const STAMP = Date.now();
const TEMPLATE_A = `E2E Anexos Obrigatorio ${STAMP}`;   // required, ALL
const TEMPLATE_B = `E2E Anexos Assinatura ${STAMP}`;    // signAtAdmission, ACTIVE_ONLY
const TEMPLATE_C = `E2E Anexos So Inativos ${STAMP}`;   // required, INACTIVE_ONLY

let api: APIRequestContext;
let token: string;
const fixtures: TemplateFixture[] = [];

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  fixtures.push(
    await createTemplate(api, token, {
      name: TEMPLATE_A,
      content: '<p>Termo de acolhimento obrigatorio.</p>',
      isRequired: true,
      signAtAdmission: false,
      availableFor: 'ALL',
    }),
    await createTemplate(api, token, {
      name: TEMPLATE_B,
      content: '<p>Termo de consentimento para assinatura no acolhimento.</p>',
      isRequired: false,
      signAtAdmission: true,
      availableFor: 'ACTIVE_ONLY',
    }),
    await createTemplate(api, token, {
      name: TEMPLATE_C,
      content: '<p>Declaracao valida apenas para filhos inativos.</p>',
      isRequired: true,
      signAtAdmission: false,
      availableFor: 'INACTIVE_ONLY',
    }),
  );
});

test.afterAll(async () => {
  for (const fixture of fixtures) await deleteTemplate(api, token, fixture.id);
  await api.dispose();
  // `openResidentFromList` troca o filtro de status, que a story 130 persiste
  // como preferência no DB compartilhado — deixa limpo para as suítes seguintes.
  await resetResidentsFilters();
});

/** Abre a aba "Anexos" do filho do seed, com a barra do PDF combinado montada. */
async function openAttachmentsTab(page: Page) {
  const card = await openResidentFromList(page, RESIDENT_NAME);
  await card.click();
  await expect(page).toHaveURL(/\/residents\/[0-9a-f-]{36}/);
  await page.getByRole('button', { name: 'Anexos', exact: true }).click();
  await expect(page).toHaveURL(/tab=attachments/);
  // Story 161 — a barra é sempre renderizada; esperar por ela é a garantia de
  // que a aba terminou de montar.
  await expect(page.getByRole('button', { name: 'Gerar PDF combinado' })).toBeVisible();
}

const selectAllCheckbox = (page: Page) =>
  page.getByRole('checkbox', { name: 'Selecionar todos os documentos' });
const combinedButton = (page: Page) => page.getByRole('button', { name: 'Gerar PDF combinado' });
const cardCheckbox = (page: Page, templateName: string) =>
  page.getByRole('checkbox', { name: `Selecionar ${templateName}` });

test.describe('Aba de anexos do filho — PDF combinado e disponibilidade por status', () => {
  test.beforeEach(async ({ page }) => {
    await resetResidentsFilters();
    await login(page);
    await openAttachmentsTab(page);
  });

  test('a barra nasce visível, sem seleção e com o botão desabilitado', async ({ page }) => {
    await expect(page.getByText('Nenhum documento selecionado')).toBeVisible();
    await expect(selectAllCheckbox(page)).toBeVisible();
    await expect(selectAllCheckbox(page)).not.toBeChecked();
    await expect(selectAllCheckbox(page)).toBeEnabled();
    await expect(combinedButton(page)).toBeDisabled();
  });

  test('o checkbox de cabeçalho marca os dois selecionáveis e habilita o botão', async ({ page }) => {
    await selectAllCheckbox(page).click();

    await expect(cardCheckbox(page, TEMPLATE_A)).toBeChecked();
    await expect(cardCheckbox(page, TEMPLATE_B)).toBeChecked();
    // Contagem no plural: os dois selecionáveis (A obrigatório + B de
    // assinatura no acolhimento) e nada além deles.
    await expect(page.getByText('2 documentos selecionados')).toBeVisible();
    await expect(selectAllCheckbox(page)).toBeChecked();
    await expect(combinedButton(page)).toBeEnabled();
  });

  test('gerar o PDF combinado baixa o arquivo e limpa a seleção', async ({ page }) => {
    // Duas renderizações de PDF no puppeteer do backend (que ainda pode estar
    // subindo o browser na primeira geração da suíte) — folga no timeout.
    test.setTimeout(120_000);

    await selectAllCheckbox(page).click();
    await expect(page.getByText('2 documentos selecionados')).toBeVisible();

    // O download é o sinal de sucesso; o `role="alert"` da aba é o de falha.
    // Correr os dois faz o teste quebrar COM a mensagem do backend quando a
    // geração é recusada, em vez de estourar um timeout mudo. Nenhuma asserção
    // é afrouxada: sem download, o teste falha.
    const errorAlert = page.locator('[role="alert"]').first();
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    const failurePromise = errorAlert
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(async () => {
        throw new Error(`A geração do PDF combinado falhou: ${await errorAlert.innerText()}`);
      });
    // No caminho de sucesso este promise perde a corrida e só rejeita quando a
    // página fecha; o catch vazio evita a unhandled rejection do runner.
    failurePromise.catch(() => {});

    await combinedButton(page).click();
    const download = await Promise.race([downloadPromise, failurePromise]);
    expect(download.suggestedFilename()).toBe('joao-testador-documentos.pdf');

    // Story 161, decisão 6 — o download é o fim do fluxo: a seleção limpa
    // sozinha, e só no caminho de sucesso.
    await expect(page.getByText('Nenhum documento selecionado')).toBeVisible();
    await expect(selectAllCheckbox(page)).not.toBeChecked();
    await expect(cardCheckbox(page, TEMPLATE_A)).not.toBeChecked();
    await expect(cardCheckbox(page, TEMPLATE_B)).not.toBeChecked();
    await expect(combinedButton(page)).toBeDisabled();
  });

  test('o checkbox de cabeçalho com tudo marcado esvazia a seleção', async ({ page }) => {
    await selectAllCheckbox(page).click();
    await expect(page.getByText('2 documentos selecionados')).toBeVisible();

    await selectAllCheckbox(page).click();

    await expect(page.getByText('Nenhum documento selecionado')).toBeVisible();
    await expect(cardCheckbox(page, TEMPLATE_A)).not.toBeChecked();
    await expect(cardCheckbox(page, TEMPLATE_B)).not.toBeChecked();
    await expect(combinedButton(page)).toBeDisabled();
  });

  test('template INACTIVE_ONLY some da aba de um filho ACTIVE; ACTIVE_ONLY aparece', async ({ page }) => {
    // Story 160 — o predicado nos dois sentidos, sobre o MESMO filho ACTIVE.
    await expect(cardCheckbox(page, TEMPLATE_B)).toBeVisible();
    await expect(page.getByText(TEMPLATE_B, { exact: true })).toBeVisible();

    await expect(cardCheckbox(page, TEMPLATE_C)).toHaveCount(0);
    await expect(page.getByText(TEMPLATE_C, { exact: true })).toHaveCount(0);

    // Não é contado nos selecionáveis: a aba tem o checkbox de cabeçalho + os
    // cards de A e B, e nada mais.
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(3);

    // Nem aparece no menu "Gerar documento" (que lista os opcionais — B está
    // lá porque é opcional e vale para ACTIVE).
    await page.getByRole('button', { name: 'Gerar documento' }).click();
    await expect(page.getByRole('menuitem', { name: TEMPLATE_B })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: TEMPLATE_C })).toHaveCount(0);
  });
});
