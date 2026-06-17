import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Contas a Pagar (Financeiro)', () => {
  const ts = () => Date.now();

  async function goto(page: import('@playwright/test').Page) {
    await page.goto('/financeiro/contas-a-pagar');
    await expect(page).toHaveURL('/financeiro/contas-a-pagar');
    await expect(page.getByRole('heading', { name: 'Contas a Pagar' })).toBeVisible();
  }

  async function createPayable(
    page: import('@playwright/test').Page,
    description: string,
    amount = '250.00',
  ) {
    await page.getByRole('button', { name: 'Nova conta' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Descrição *').fill(description);
    await page.getByLabel('Valor (R$) *').fill(amount);
    await page.getByLabel('Vencimento *').fill('2026-06-20');
    await page.getByLabel('Categoria *').selectOption('UTILITIES');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: description })).toBeVisible();
  }

  test('ADMIN vê o menu Contas a Pagar (top-level) e navega', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Contas a Pagar' }).click();
    await expect(page).toHaveURL('/financeiro/contas-a-pagar');
    await expect(page.getByRole('heading', { name: 'Contas a Pagar' })).toBeVisible();
  });

  test('exibe os cards de resumo (a pagar / vencidas / pagas)', async ({ page }) => {
    await login(page);
    await goto(page);
    await expect(page.getByText('A pagar (em aberto)')).toBeVisible();
    await expect(page.getByText('Vencidas')).toBeVisible();
    await expect(page.getByText('Pagas')).toBeVisible();
  });

  test('cria uma conta a pagar e ela aparece na lista', async ({ page }) => {
    await login(page);
    await goto(page);
    const name = `Conta Luz ${ts()}`;
    await createPayable(page, name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row.getByText('Em aberto')).toBeVisible();
  });

  test('filtra por status (Paga não mostra a conta em aberto)', async ({ page }) => {
    await login(page);
    await goto(page);
    const name = `Conta Filtro ${ts()}`;
    await createPayable(page, name);

    await page.getByLabel('Status').selectOption('PAID');
    await expect(page.getByRole('cell', { name })).not.toBeVisible();

    await page.getByLabel('Status').selectOption('OPEN');
    await expect(page.getByRole('cell', { name })).toBeVisible();
  });

  test('marca uma conta como paga', async ({ page }) => {
    await login(page);
    await goto(page);
    const name = `Conta Pagar ${ts()}`;
    await createPayable(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Marcar como paga').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Após a baixa, a conta perde o botão "Marcar como paga" e exibe o status "Paga".
    const paidRow = page.getByRole('row', { name: new RegExp(name) });
    await expect(paidRow.getByTitle('Marcar como paga')).toHaveCount(0);
    await expect(paidRow.getByText('Paga', { exact: true })).toBeVisible();
  });

  test('exclui uma conta e ela some da lista', async ({ page }) => {
    await login(page);
    await goto(page);
    const name = `Conta Excluir ${ts()}`;
    await createPayable(page, name);

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByRole('cell', { name })).not.toBeVisible();
  });

  test('não-admin (coordinator) não vê o menu Contas a Pagar', async ({ page }) => {
    await login(page, 'coord@fonte.com', 'coord123');
    await expect(page.getByRole('link', { name: 'Contas a Pagar' })).toHaveCount(0);
    // E o acesso direto à rota redireciona (ProtectedRoute ADMIN).
    await page.goto('/financeiro/contas-a-pagar');
    await expect(page.getByRole('heading', { name: 'Contas a Pagar' })).toHaveCount(0);
  });
});
