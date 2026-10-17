import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, loginApi } from './helpers/api';
import { resetResidentsFilters } from './helpers/preferences';
import { createPaidCharge, deleteChargesOf } from './helpers/associateCharges';
import {
  createResidentWithPaidReceivable,
  deleteResidentFixture,
  type PaidReceivableFixture,
} from './helpers/residentReceivables';

/**
 * Story 178 — recibo da contribuição, do cadastro do template ao download.
 *
 * O fluxo do plano, inteiro: criar o template de recibo em Configurações →
 * abrir o associado com cobrança paga → baixar o recibo → conferir que o
 * template de recibo NÃO aparece na aba de Anexos de um filho.
 *
 * Como todo template de recibo criado aqui é removido no `afterAll`, nenhuma
 * outra suíte enxerga um tipo de recibo ocupado (um template ativo POR TIPO).
 */
const RESIDENT_NAME = 'João Testador'; // filho ACTIVE do seed
const STAMP = Date.now();
const RECEIPT_NAME = `E2E Recibo ${STAMP}`;
const ASSOCIATE_NAME = `E2E Pagador ${STAMP}`;
// Story 193 — o recibo do acolhido, com fixture própria de filho + parcela paga.
const RESIDENT_RECEIPT_NAME = `E2E Recibo do acolhido ${STAMP}`;
const PAYER_RESIDENT_NAME = `E2E Filho Pagante ${STAMP}`;

let api: APIRequestContext;
let token: string;
let associateId: string;
let residentFixture: PaidReceivableFixture;

async function receiptTemplateIds(): Promise<string[]> {
  const res = await api.get(`${API_URL}/document-templates?kind=RECEIPT`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((await res.json()) as { id: string }[]).map((t) => t.id);
}

async function clearReceiptTemplates() {
  for (const id of await receiptTemplateIds()) {
    await api.delete(`${API_URL}/document-templates/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  token = await loginApi(api);
  await clearReceiptTemplates();

  const created = await api.post(`${API_URL}/associates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: ASSOCIATE_NAME,
      whatsapp: '+5562988887766',
      contributionAmount: 51.75,
      dueDay: 10,
    },
  });
  expect(created.ok()).toBeTruthy();
  associateId = (await created.json()).id as string;
  await createPaidCharge(associateId);

  residentFixture = await createResidentWithPaidReceivable(api, token, PAYER_RESIDENT_NAME);
});

test.afterAll(async () => {
  await clearReceiptTemplates();
  await deleteChargesOf(associateId);
  if (residentFixture) await deleteResidentFixture(api, token, residentFixture);
  await api.delete(`${API_URL}/associates/${associateId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await api.dispose();
  // `openResidentFromList` troca o filtro de status, persistido como preferência
  // no DB compartilhado (story 130).
  await resetResidentsFilters();
});

async function gotoTemplates(page: Page) {
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('link', { name: 'Templates de documentos' }).click();
  await expect(page).toHaveURL('/settings/templates');
}

test.describe('Recibos (stories 178 e 193)', () => {
  // O fluxo é longo de propósito (cadastro + edição + geração real do PDF pelo
  // puppeteer + navegação); o default de 30s não cobre a renderização do PDF.
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ── Story 212: o tipo à vista, escolhido e editável ─────────────────────────
  // Roda primeiro (workers: 1, ordem do arquivo): sem nenhum recibo cadastrado,
  // os dois tipos estão livres para a troca. O template é removido por id no
  // fim do próprio teste, liberando os tipos para os testes seguintes.
  test('cria recibo escolhendo o tipo, vê o badge e troca o tipo no editor', async ({ page }) => {
    const name = `E2E Recibo tipo ${STAMP}`;
    await gotoTemplates(page);
    await page.getByRole('button', { name: 'Novo recibo' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const typeSelect = dialog.getByLabel('Tipo de recibo');
    await expect(typeSelect).toHaveValue('');
    await dialog.getByLabel('Nome do documento').fill(name);
    // Sem escolher o tipo, não cria.
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog.getByText('Selecione o tipo de recibo')).toBeVisible();
    await typeSelect.selectOption({ label: 'Contribuição mensal do acolhido' });
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog).not.toBeVisible();

    // Badge do tipo no card da lista.
    const card = page.locator('div.cursor-pointer').filter({ hasText: name });
    await expect(card.getByText('Contribuição mensal do acolhido')).toBeVisible();

    // Editor: badge no cabeçalho + troca do tipo.
    await card.getByText(name, { exact: true }).click();
    const headerBadge = page.getByTestId('editing-receipt-type');
    await expect(headerBadge).toHaveText('Contribuição mensal do acolhido');
    const editorType = page.getByLabel('Tipo de recibo');
    await expect(editorType).toHaveValue('RESIDENT_CONTRIBUTION');
    await editorType.selectOption({ label: 'Contribuição mensal do associado' });
    await expect(editorType).toHaveValue('ASSOCIATE_CONTRIBUTION');
    await expect(headerBadge).toHaveText('Contribuição mensal do associado');

    // De volta à lista, o badge mudou (gravado no servidor).
    await page.getByRole('button', { name: 'Voltar' }).click();
    const updatedCard = page.locator('div.cursor-pointer').filter({ hasText: name });
    await expect(updatedCard.getByText('Contribuição mensal do associado')).toBeVisible();
    await expect(updatedCard.getByText('Contribuição mensal do acolhido')).toHaveCount(0);

    // Limpeza por id (story 182): só o que este teste criou.
    const res = await api.get(`${API_URL}/document-templates?kind=RECEIPT`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const created = ((await res.json()) as { id: string; name: string }[]).find(
      (t) => t.name === name,
    );
    expect(created).toBeTruthy();
    await api.delete(`${API_URL}/document-templates/${created!.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('cadastra o recibo, baixa o PDF da cobrança paga e o template não vaza para os anexos do filho', async ({
    page,
  }) => {
    // ── 1. Cadastro do template, no grupo Recibos ─────────────────────────────
    await gotoTemplates(page);
    await expect(page.getByText('Documentos do acolhido')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recibos' })).toBeVisible();

    await page.getByRole('button', { name: 'Novo recibo' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // O tipo só é pedido no grupo Recibos, e só os tipos com resolver aparecem.
    const typeSelect = dialog.getByLabel('Tipo de recibo');
    await expect(typeSelect).toBeVisible();
    // Story 193 — dois tipos com resolver: associado e acolhido. Pizza e pão
    // seguem fora (declarados no enum, sem resolver). Story 212 — mais o
    // placeholder "Selecione o tipo", que é o valor inicial (sem pré-seleção).
    await expect(typeSelect.locator('option')).toHaveCount(3);
    await expect(typeSelect).toHaveValue('');
    await typeSelect.selectOption({ label: 'Contribuição mensal do associado' });
    await dialog.getByLabel('Nome do documento').fill(RECEIPT_NAME);
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(RECEIPT_NAME, { exact: true })).toBeVisible();

    // ── 2. O editor do recibo é o do OUTRO mundo ──────────────────────────────
    await page.getByText(RECEIPT_NAME, { exact: true }).click();
    await expect(page.getByLabel('Exigir no acolhimento')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Todos' })).toHaveCount(0);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Recibo ');
    await page.keyboard.type('{{');
    const popup = page.locator('[data-variable-suggestion]');
    await expect(popup).toBeVisible();
    await page.keyboard.type('numero');
    await expect(popup.getByText('Número do recibo')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(editor).toContainText('{{receiptNumber}}');

    await page.getByRole('button', { name: 'Recolher variáveis' }).click();
    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    // ── 3. Download do recibo no detalhe do associado ─────────────────────────
    await page.goto('/billing/associados/lista');
    await page.getByRole('cell', { name: ASSOCIATE_NAME }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Histórico de contribuições')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await detail.getByRole('button', { name: 'Recibo' }).click();
    const download = await downloadPromise;
    // O nome do arquivo carrega o número sequencial já alocado (6 dígitos).
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    // Caminho feliz não passa pelo getErrorMessage.
    await expect(detail.getByText(/Falha ao gerar o recibo/)).toHaveCount(0);

    // ── 4. O recibo NÃO aparece na aba de Anexos do filho ─────────────────────
    await page.keyboard.press('Escape');
    await expect(detail).not.toBeVisible();
    // `goto` em vez do link da sidebar: dentro de Faturamento existem DOIS links
    // "Filhos" (o do menu principal e o do submenu de faturamento).
    await page.goto('/residents');
    await page.locator('select').first().selectOption('');
    await page.getByPlaceholder('Buscar por nome...').fill(RESIDENT_NAME);
    const card = page.locator('.rounded-lg.border.bg-card').filter({ hasText: RESIDENT_NAME });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/residents\/[0-9a-f-]{36}/);
    await page.getByRole('button', { name: 'Anexos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gerar PDF combinado' })).toBeVisible();
    await expect(page.getByText(RECEIPT_NAME, { exact: true })).toHaveCount(0);
  });

  // ── Story 193: o segundo tipo de recibo, ponta a ponta ─────────────────────
  test('cadastra o recibo do acolhido, baixa o PDF da parcela paga e o template não vaza para os anexos', async ({
    page,
  }) => {
    // ── 0. Story 212: sem template do tipo, o erro oferece o atalho ───────────
    await page.goto(`/residents/${residentFixture.residentId}`);
    await page.getByRole('button', { name: 'Contribuição', exact: true }).click();
    await page.getByRole('button', { name: /Recibo/ }).first().click();
    await expect(page.getByText(/Cadastre em Configurações → Templates/)).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Cadastrar template' }).click();

    // ── 1. Cadastro do template do tipo NOVO, já pré-escolhido pelo atalho ────
    await expect(page).toHaveURL('/settings/templates');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Tipo de recibo')).toHaveValue('RESIDENT_CONTRIBUTION');
    await dialog.getByLabel('Nome do documento').fill(RESIDENT_RECEIPT_NAME);
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog).not.toBeVisible();

    // ── 2. O editor oferece os tokens DO ACOLHIDO ─────────────────────────────
    await page.getByText(RESIDENT_RECEIPT_NAME, { exact: true }).click();
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Recibo ');
    await page.keyboard.type('{{');
    const popup = page.locator('[data-variable-suggestion]');
    await expect(popup).toBeVisible();
    await page.keyboard.type('acolhido');
    await expect(popup.getByText('Acolhido — nome')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(editor).toContainText('{{residentName}}');

    await page.getByRole('button', { name: 'Recolher variáveis' }).click();
    await page.getByRole('button', { name: 'Salvar template' }).click();
    await expect(page.getByText('Template salvo')).toBeVisible({ timeout: 15000 });

    // ── 3. Download do recibo na aba Contribuição do filho ────────────────────
    await page.goto(`/residents/${residentFixture.residentId}`);
    await page.getByRole('button', { name: 'Contribuição', exact: true }).click();
    const receiptButton = page.getByRole('button', { name: /Recibo/ }).first();
    await expect(receiptButton).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await receiptButton.click();
    const download = await downloadPromise;
    // Story 212 — recibo-{filho}-{MM}-{AAAA}.pdf, pela competência da parcela.
    const [year, month] = residentFixture.referenceMonth.split('-');
    expect(download.suggestedFilename()).toBe(
      `recibo-e2e-filho-pagante-${STAMP}-${month}-${year}.pdf`,
    );
    // Caminho feliz não passa pelo getErrorMessage.
    await expect(page.getByText(/Falha ao gerar o recibo/)).toHaveCount(0);

    // ── 4. O template do recibo NÃO aparece nos anexos de nenhum filho ────────
    await page.getByRole('button', { name: 'Anexos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gerar PDF combinado' })).toBeVisible();
    await expect(page.getByText(RESIDENT_RECEIPT_NAME, { exact: true })).toHaveCount(0);
  });
});
