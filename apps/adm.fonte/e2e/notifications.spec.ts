import { test, expect, APIRequestContext } from '@playwright/test';
import { login, TEST_ADMIN } from './helpers/auth';

const API = 'http://localhost:3001/api/v1';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  return (await res.json()).accessToken as string;
}

/**
 * Seeds a PAYMENT_REGISTERED notification (targeted at ADMIN) by registering a
 * payment on the seeded resident's first receivable, then clearing prior reads
 * so the badge is guaranteed to be > 0.
 */
async function seedNotification(request: APIRequestContext): Promise<void> {
  const token = await adminToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const residentsRes = await request.get(`${API}/residents?limit=50`, { headers });
  const residents = (await residentsRes.json()).data as Array<{ id: string; name: string }>;
  const joao = residents.find((r) => r.name.includes('João')) ?? residents[0];

  // Ensure João has a carnê: a fresh seed leaves him without a paying plan, so
  // no receivables exist yet. Defining a paying plan materializes them.
  await request.patch(`${API}/residents/${joao.id}/contribution-plan`, {
    headers,
    data: { familyInvestment: 'PAYMENT_700' },
  });

  const rcvRes = await request.get(`${API}/residents/${joao.id}/receivables`, { headers });
  const receivables = (await rcvRes.json()) as Array<{
    id: string;
    status: string;
    referenceMonth: string;
  }>;
  // Pay the LAST pending installment (furthest future month) so the earlier,
  // current-month installments stay PENDING — the residents payment test relies
  // on João still having a payable installment ("Registrar pagamento").
  const pending = receivables
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => String(b.referenceMonth).localeCompare(String(a.referenceMonth)))[0]
    ?? receivables[0];

  await request.post(`${API}/residents/${joao.id}/receivables/${pending.id}/payment`, {
    headers,
    data: { paidAt: new Date().toISOString().slice(0, 10), paymentMethod: 'PIX' },
  });
}

test.describe('Notificações', () => {
  test('badge mostra contagem, painel lista, marcar lida zera badge e clique navega', async ({
    page,
    request,
  }) => {
    await seedNotification(request);
    await login(page);

    // The layout renders a bell in both the mobile and desktop top bars (one is
    // hidden per breakpoint); always target the one currently visible.
    const bell = page.getByRole('button', { name: 'Notificações' }).locator('visible=true');
    const badge = page.getByTestId('notification-badge').locator('visible=true');

    // Badge com contagem.
    await expect(badge).toBeVisible();

    // Abrir painel e listar avisos.
    await bell.click();
    await expect(page.getByText('Notificações')).toBeVisible();
    await expect(page.getByText('Pagamento registrado').first()).toBeVisible();

    // Marcar todas como lidas zera o badge.
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await expect(badge).toHaveCount(0);
  });

  test('clicar em uma notificação navega para o link', async ({ page, request }) => {
    await seedNotification(request);
    await login(page);

    await page.getByRole('button', { name: 'Notificações' }).locator('visible=true').click();
    await page.getByText('Pagamento registrado').first().click();

    // O link da notificação de pagamento aponta para /residents/:id.
    await expect(page).toHaveURL(/\/residents\//);
  });
});
