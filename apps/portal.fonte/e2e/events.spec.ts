import { test, expect, type Page } from '@playwright/test';

/**
 * Fluxo público de eventos (app `portal.fonte`, story 58). Os endpoints
 * `/public/events*` são MOCKADOS via page.route — a API real nunca é chamada.
 */

const EVENT_ID = 'evt-1';

const openEvent = {
  id: EVENT_ID,
  title: 'Retiro de Famílias',
  description: 'Encontro anual da comunidade',
  startAt: '2027-01-10T18:00:00.000Z',
  endAt: null,
  location: 'Sede',
  bannerUrl: null,
  capacity: 50,
  spotsLeft: 12,
  registrationOpensAt: null,
  registrationClosesAt: null,
  registrationEnabled: true,
  registrationOpen: true,
};

async function mockList(page: Page, body: unknown) {
  await page.route('**/public/events', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function mockDetail(page: Page, id: string, body: unknown) {
  await page.route(`**/public/events/${id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function mockRegister(page: Page, id: string) {
  await page.route(`**/public/events/${id}/register`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'reg-1', eventId: id, name: 'Maria' }),
    });
  });
}

test('lista pública mostra os eventos abertos', async ({ page }) => {
  await mockList(page, [openEvent]);
  await page.goto('/eventos');
  await expect(page.getByRole('heading', { name: 'Eventos' })).toBeVisible();
  await expect(page.getByText('Retiro de Famílias')).toBeVisible();
});

test('inscreve-se num evento e vê a confirmação', async ({ page }) => {
  await mockDetail(page, EVENT_ID, openEvent);
  await mockRegister(page, EVENT_ID);

  await page.goto(`/eventos/${EVENT_ID}`);
  await expect(page.getByRole('heading', { name: 'Retiro de Famílias' })).toBeVisible();
  await expect(page.getByText(/12 vaga\(s\) restante\(s\)/)).toBeVisible();

  await page.getByLabel('Nome').fill('Maria das Dores');
  await page.getByLabel('Telefone / WhatsApp').fill('11999990000');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();

  await expect(page.getByRole('heading', { name: /inscrição confirmada/i })).toBeVisible();
});

test('evento esgotado mostra "Vagas esgotadas"', async ({ page }) => {
  await mockDetail(page, EVENT_ID, { ...openEvent, spotsLeft: 0, registrationOpen: false });

  await page.goto(`/eventos/${EVENT_ID}`);
  await expect(page.getByRole('heading', { name: 'Vagas esgotadas' })).toBeVisible();
});

// Story 95: destino do convite via WhatsApp — evento sem inscrição (interno /
// só-divulgação) resolve por link direto e mostra só a info, sem formulário.
test('evento sem inscrição mostra a info sem o formulário', async ({ page }) => {
  await mockDetail(page, EVENT_ID, {
    ...openEvent,
    title: 'Encontro dos Servos',
    capacity: null,
    spotsLeft: null,
    registrationEnabled: false,
    registrationOpen: false,
  });

  await page.goto(`/eventos/${EVENT_ID}`);
  await expect(page.getByRole('heading', { name: 'Encontro dos Servos' })).toBeVisible();
  await expect(page.getByText('Sede')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inscreva-se' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inscrições encerradas' })).not.toBeVisible();
});
