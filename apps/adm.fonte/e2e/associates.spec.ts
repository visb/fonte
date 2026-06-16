import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Associados', () => {
  const ts = () => Date.now();

  // O overview é a porta de entrada; a lista é uma rota separada.
  async function gotoList(page: import('@playwright/test').Page) {
    await page.goto('/billing/associados/lista');
    await expect(page).toHaveURL('/billing/associados/lista');
    await expect(page.getByRole('heading', { name: 'Associados' })).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function createAssociate(page: import('@playwright/test').Page, name: string) {
    await page.getByRole('button', { name: 'Novo associado' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('WhatsApp *').fill('+5562999998888');
    await page.getByLabel('Contribuição (R$) *').fill('75.5');
    await page.getByLabel('Dia de vencimento *').fill('10');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();
  }

  test('/billing/associados abre o overview de faturamento por padrão', async ({ page }) => {
    await page.goto('/billing/associados');
    await expect(page).toHaveURL('/billing/associados');
    await expect(
      page.getByText('Visão de gestão do faturamento mês a mês.'),
    ).toBeVisible();
    await expect(page.getByText('Esperado no mês')).toBeVisible();
    await expect(page.getByText('Arrecadado no mês')).toBeVisible();
  });

  test('navega do overview para a lista pelo botão "Ver associados"', async ({ page }) => {
    await page.goto('/billing/associados');
    await page.getByRole('link', { name: 'Ver associados' }).click();
    await expect(page).toHaveURL('/billing/associados/lista');
    await expect(page.getByRole('button', { name: 'Novo associado' })).toBeVisible();
  });

  test('volta da lista para o overview pelo link "Voltar ao overview"', async ({ page }) => {
    await gotoList(page);
    await page.getByRole('link', { name: 'Voltar ao overview' }).click();
    await expect(page).toHaveURL('/billing/associados');
    await expect(
      page.getByText('Visão de gestão do faturamento mês a mês.'),
    ).toBeVisible();
  });

  test('máscara normaliza número nacional para E.164 válido e submete', async ({ page }) => {
    await gotoList(page);
    const name = `Associado E164 ${ts()}`;
    await page.getByRole('button', { name: 'Novo associado' }).click();
    await page.getByLabel('Nome *').fill(name);
    // Número nacional sem DDI; a máscara grava E.164 (+55...), válido pelo schema.
    await page.getByLabel('WhatsApp *').fill('62999998888');
    await page.getByLabel('Contribuição (R$) *').fill('50');
    await page.getByLabel('Dia de vencimento *').fill('10');
    await page.getByRole('button', { name: 'Criar' }).click();
    // Sem erro de E.164 e o dialog fecha (criou com sucesso).
    await expect(page.getByText(/E\.164/)).toHaveCount(0);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();
  });

  test('valida WhatsApp obrigatório (schema continua a fonte da validação)', async ({ page }) => {
    await gotoList(page);
    await page.getByRole('button', { name: 'Novo associado' }).click();
    await page.getByLabel('Nome *').fill('Sem WhatsApp');
    await page.getByLabel('Contribuição (R$) *').fill('50');
    await page.getByLabel('Dia de vencimento *').fill('10');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText('WhatsApp é obrigatório')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('cria associado e aparece na lista com status Pendente', async ({ page }) => {
    await gotoList(page);
    const name = `Associado E2E ${ts()}`;
    await createAssociate(page, name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row.getByText('Pendente')).toBeVisible();
  });

  test('aplica máscara de WhatsApp e grava E.164', async ({ page }) => {
    await gotoList(page);
    await page.getByRole('button', { name: 'Novo associado' }).click();
    const wpp = page.getByLabel('WhatsApp *');
    // Digitar só dígitos nacionais → exibição mascarada com +55 e parênteses.
    await wpp.fill('62999998888');
    await expect(wpp).toHaveValue('+55 (62) 99999-8888');
  });

  test('clicar na linha abre o detalhe com data de adesão e histórico', async ({ page }) => {
    await gotoList(page);
    const name = `Associado Detalhe ${ts()}`;
    await createAssociate(page, name);

    await page.getByRole('cell', { name }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Data de adesão')).toBeVisible();
    await expect(dialog.getByText('Histórico de contribuições')).toBeVisible();
    // Recém-criado não tem cobranças → empty state.
    await expect(dialog.getByText('Nenhuma cobrança registrada.')).toBeVisible();
  });

  test('botões de ação na linha não abrem o detalhe', async ({ page }) => {
    await gotoList(page);
    const name = `Associado StopProp ${ts()}`;
    await createAssociate(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Editar').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar associado' })).toBeVisible();
  });

  test('edita associado existente', async ({ page }) => {
    await gotoList(page);
    const name = `Associado Editar ${ts()}`;
    const updated = `${name} (Editado)`;
    await createAssociate(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Nome *').fill(updated);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: updated })).toBeVisible();
  });

  test('exclui associado e some da lista', async ({ page }) => {
    await gotoList(page);
    const name = `Associado Excluir ${ts()}`;
    await createAssociate(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByRole('cell', { name })).not.toBeVisible();
  });
});
