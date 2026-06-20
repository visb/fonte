import { test, expect, type Page } from '@playwright/test';

/**
 * Página de pagamento da inscrição em evento (story 70). Os endpoints
 * `/public/event-payments/:token` são MOCKADOS via page.route — a API real e o
 * gateway (Pagar.me) nunca são chamados. O tokenizer roda em modo stub.
 */

const TOKEN = 'pay-tok-123';

const pendingView = {
  eventTitle: 'Retiro pago',
  amountCents: 5248,
  paymentStatus: 'PENDING',
  paymentMethod: null,
  registrantName: 'Maria',
};

async function mockInfo(page: Page, token: string, status: number, body: unknown) {
  await page.route(`**/public/event-payments/${token}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function mockPay(page: Page, token: string, body: unknown) {
  await page.route(`**/public/event-payments/${token}/pay`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('token inválido mostra tela de erro', async ({ page }) => {
  await mockInfo(page, TOKEN, 404, { message: 'not found' });
  await page.goto(`/pagamento/${TOKEN}`);
  await expect(page.getByRole('heading', { name: /link inválido ou expirado/i })).toBeVisible();
});

test('PENDING mostra valor e métodos; PIX gera QR', async ({ page }) => {
  await mockInfo(page, TOKEN, 200, pendingView);
  await mockPay(page, TOKEN, {
    paymentStatus: 'PENDING',
    method: 'pix',
    pix: { qrCode: '00020126PIX-EMV', qrCodeUrl: 'https://qr/img.png', expiresAt: null },
  });

  await page.goto(`/pagamento/${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Retiro pago' })).toBeVisible();
  await expect(page.getByText('R$ 52,48')).toBeVisible();

  await page.getByRole('button', { name: 'PIX' }).click();
  await page.getByRole('button', { name: 'Gerar PIX' }).click();

  await expect(page.getByRole('heading', { name: /pague com pix/i })).toBeVisible();
  await expect(page.getByAltText('QR code do PIX')).toBeVisible();
});

test('cartão envia cardToken (tokenizer stub) e mostra confirmação após PAID', async ({ page }) => {
  let paid = false;
  await page.route(`**/public/event-payments/${TOKEN}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paid ? { ...pendingView, paymentStatus: 'PAID' } : pendingView),
    });
  });
  await page.route(`**/public/event-payments/${TOKEN}/pay`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    paid = true; // o webhook confirma; o próximo GET vem PAID.
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ paymentStatus: 'PENDING', method: 'credit_card', pix: null }),
    });
  });

  await page.goto(`/pagamento/${TOKEN}`);
  await page.getByRole('button', { name: 'Cartão de crédito' }).click();
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('MARIA D');
  await page.getByLabel('Mês (MM)').fill('12');
  await page.getByLabel('Ano (AA)').fill('30');
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('button', { name: 'Pagar com cartão' }).click();

  // Polling do hook (PENDING → PAID) leva à confirmação.
  await expect(page.getByRole('heading', { name: /pagamento confirmado/i })).toBeVisible();
});
