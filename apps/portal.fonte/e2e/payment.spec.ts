import { test, expect, type Page } from '@playwright/test';

/**
 * Fluxo público de adesão (app `portal.fonte`). Todos os endpoints
 * `/public/associates/:token` são MOCKADOS via page.route — a API real e o
 * gateway de cartão (Pagar.me) nunca são chamados. O tokenizer roda em modo stub
 * (sem VITE_PAGARME_PUBLIC_KEY no dev).
 */

const VALID_TOKEN = 'tok-valido-123';
const INVALID_TOKEN = 'tok-invalido-999';

const validView = {
  name: 'Maria das Dores',
  suggestedAmount: 100,
  dueDay: 10,
  status: 'PENDING',
  hasActiveSubscription: false,
};

async function mockGet(page: Page, token: string, status: number, body: unknown) {
  await page.route(`**/public/associates/${token}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function mockSubscribe(page: Page, token: string) {
  await page.route(`**/public/associates/${token}/subscribe`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ACTIVE',
        subscription: { id: 'sub-1' },
        charge: { id: 'chg-1' },
        checkoutUrl: null,
      }),
    });
  });
}

test('token inválido mostra tela de erro amigável', async ({ page }) => {
  await mockGet(page, INVALID_TOKEN, 404, { message: 'Token inválido' });

  await page.goto(`/p/${INVALID_TOKEN}`);

  await expect(
    page.getByRole('heading', { name: /link inválido ou expirado/i }),
  ).toBeVisible();
});

test('token válido pré-preenche nome e mostra o gross-up no AmountSummary', async ({ page }) => {
  await mockGet(page, VALID_TOKEN, 200, validView);

  await page.goto(`/p/${VALID_TOKEN}`);

  await expect(page.getByRole('heading', { name: /olá, maria das dores/i })).toBeVisible();
  await expect(page.getByText('Sua contribuição (a Fonte recebe)')).toBeVisible();
  await expect(page.getByText('Taxa do cartão')).toBeVisible();
  await expect(page.getByText('Cobrado no cartão')).toBeVisible();
});

test('submit com tokenizer stub leva à tela de confirmação', async ({ page }) => {
  await mockGet(page, VALID_TOKEN, 200, validView);
  await mockSubscribe(page, VALID_TOKEN);

  await page.goto(`/p/${VALID_TOKEN}`);
  await expect(page.getByRole('heading', { name: /olá, maria das dores/i })).toBeVisible();

  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('MARIA D DORES');
  await page.getByLabel('Mês (MM)').fill('12');
  await page.getByLabel('Ano (AA)').fill('30');
  await page.getByLabel('CVV').fill('123');

  await page.getByRole('button', { name: /ativar contribuição mensal/i }).click();

  await expect(
    page.getByRole('heading', { name: /contribuição mensal ativada/i }),
  ).toBeVisible();
});
