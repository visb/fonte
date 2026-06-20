import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';
process.env.PAGARME_WEBHOOK_USER = process.env.PAGARME_WEBHOOK_USER ?? 'hookuser';
process.env.PAGARME_WEBHOOK_PASSWORD = process.env.PAGARME_WEBHOOK_PASSWORD ?? 'hookpass';
// Taxas determinísticas p/ o gross-up (R$50,00 → 5248c com 3,99% + R$0,39).
process.env.PAGARME_CARD_FEE_PCT = '0.0399';
process.env.PAGARME_CARD_FEE_FIXED = '0.39';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';
import { PAYMENT_GATEWAY } from '../src/modules/associate/gateway/gateway.types';

/**
 * E2E do pagamento avulso da inscrição em evento (story 69). O gateway é MOCKADO
 * via override de PAYMENT_GATEWAY — a API real da Pagar.me nunca é chamada (sem
 * chave). Cobre: register grátis (sem token), register pago (token + PENDING +
 * gross-up), GET por token (404 inválido), pay cartão/PIX, webhook PAID/idempotência,
 * 409 já-pago, e o admin vendo payment_status.
 */
describe('Events payment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let createOrder: jest.Mock;

  const WH_AUTH = `Basic ${Buffer.from(
    `${process.env.PAGARME_WEBHOOK_USER}:${process.env.PAGARME_WEBHOOK_PASSWORD}`,
  ).toString('base64')}`;

  let seq = 0;

  beforeAll(async () => {
    createOrder = jest.fn().mockImplementation(() => {
      seq += 1;
      return Promise.resolve({
        orderId: `or_e2e_${seq}`,
        chargeId: `ch_e2e_${seq}`,
        status: 'pending',
        pixQrCode: '00020126PIX-EMV',
        pixQrCodeUrl: 'https://qr/img.png',
        pixExpiresAt: '2026-07-01T13:00:00Z',
      });
    });
    const gatewayMock = {
      createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_e2e' }),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      createOrder,
    };

    app = await bootstrapApp({
      overrideProvider: { token: PAYMENT_GATEWAY, useValue: gatewayMock },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM event_registrations');
    await dataSource.query('DELETE FROM events');
    await app.close();
  });

  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  async function createEvent(body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ registrationEnabled: true, ...body })
      .expect(201);
    return res.body.id;
  }

  async function paidEvent(): Promise<string> {
    return createEvent({
      title: 'Retiro pago',
      description: 'd',
      startAt: future(30),
      paymentEnabled: true,
      priceCents: 5000,
    });
  }

  async function register(eventId: string): Promise<{ token: string | null; status: string }> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/public/events/${eventId}/register`)
      .send({ name: 'Maria', contact: '11999990000', email: 'maria@example.com' })
      .expect(201);
    return { token: res.body.paymentToken, status: res.body.paymentStatus };
  }

  // ── Create validation ─────────────────────────────────────────────────────────

  it('400 ao criar evento pago sem priceCents', () =>
    request(app.getHttpServer())
      .post(`${BASE}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Pago sem preço',
        description: 'd',
        startAt: future(30),
        registrationEnabled: true,
        paymentEnabled: true,
      })
      .expect(400));

  // ── Register ────────────────────────────────────────────────────────────────

  it('register grátis: NONE e sem payment_token', async () => {
    const id = await createEvent({ title: 'Grátis', description: 'd', startAt: future(30) });
    const { token, status } = await register(id);
    expect(status).toBe('NONE');
    expect(token).toBeNull();
  });

  it('register pago: PENDING + payment_token + amount_cents com gross-up', async () => {
    const id = await paidEvent();
    const { token, status } = await register(id);
    expect(status).toBe('PENDING');
    expect(typeof token).toBe('string');

    const info = await request(app.getHttpServer())
      .get(`${BASE}/public/event-payments/${token}`)
      .expect(200);
    expect(info.body.amountCents).toBe(5248);
    expect(info.body.paymentStatus).toBe('PENDING');
    expect(info.body.eventTitle).toBe('Retiro pago');
  });

  // ── Payment by token ──────────────────────────────────────────────────────────

  it('GET /public/event-payments/:token → 404 token inválido', () =>
    request(app.getHttpServer())
      .get(`${BASE}/public/event-payments/00000000-0000-0000-0000-000000000000`)
      .expect(404));

  it('pay cartão cria a order no gateway (sem pix)', async () => {
    const id = await paidEvent();
    const { token } = await register(id);

    const res = await request(app.getHttpServer())
      .post(`${BASE}/public/event-payments/${token}/pay`)
      .send({ method: 'credit_card', cardToken: 'card_tok' })
      .expect(201);

    expect(res.body.method).toBe('credit_card');
    expect(res.body.pix).toBeNull();
    expect(createOrder).toHaveBeenCalled();
  });

  it('pay PIX devolve qr_code/copia-e-cola', async () => {
    const id = await paidEvent();
    const { token } = await register(id);

    const res = await request(app.getHttpServer())
      .post(`${BASE}/public/event-payments/${token}/pay`)
      .send({ method: 'pix' })
      .expect(201);

    expect(res.body.pix.qrCode).toBe('00020126PIX-EMV');
    expect(res.body.pix.qrCodeUrl).toBe('https://qr/img.png');
  });

  it('pay cartão sem cardToken → 400', async () => {
    const id = await paidEvent();
    const { token } = await register(id);
    await request(app.getHttpServer())
      .post(`${BASE}/public/event-payments/${token}/pay`)
      .send({ method: 'credit_card' })
      .expect(400);
  });

  // ── Webhook ───────────────────────────────────────────────────────────────────

  it('webhook charge.paid → inscrição PAID (idempotente)', async () => {
    const id = await paidEvent();
    const { token } = await register(id);

    const pay = await request(app.getHttpServer())
      .post(`${BASE}/public/event-payments/${token}/pay`)
      .send({ method: 'pix' })
      .expect(201);
    expect(pay.body.paymentStatus).toBe('PENDING');

    // Descobre o gateway_charge_id da inscrição p/ rotear o webhook.
    const reg = await dataSource.query(
      `SELECT id, gateway_charge_id FROM event_registrations WHERE payment_token = $1`,
      [token],
    );
    const chargeId = reg[0].gateway_charge_id;

    const body = {
      type: 'charge.paid',
      data: { id: chargeId, metadata: { origin: 'event', event_registration_id: reg[0].id } },
    };

    await request(app.getHttpServer())
      .post(`${BASE}/webhooks/pagarme`)
      .set('Authorization', WH_AUTH)
      .send(body)
      .expect(200);

    const info = await request(app.getHttpServer())
      .get(`${BASE}/public/event-payments/${token}`)
      .expect(200);
    expect(info.body.paymentStatus).toBe('PAID');

    // Idempotente: reenviar não muda nada e segue 200.
    await request(app.getHttpServer())
      .post(`${BASE}/webhooks/pagarme`)
      .set('Authorization', WH_AUTH)
      .send(body)
      .expect(200);
    const info2 = await request(app.getHttpServer())
      .get(`${BASE}/public/event-payments/${token}`)
      .expect(200);
    expect(info2.body.paymentStatus).toBe('PAID');
  });

  it('pay em inscrição já PAID → 409', async () => {
    const id = await paidEvent();
    const { token } = await register(id);
    const reg = await dataSource.query(
      `SELECT id FROM event_registrations WHERE payment_token = $1`,
      [token],
    );
    await dataSource.query(
      `UPDATE event_registrations SET payment_status = 'PAID' WHERE id = $1`,
      [reg[0].id],
    );

    await request(app.getHttpServer())
      .post(`${BASE}/public/event-payments/${token}/pay`)
      .send({ method: 'pix' })
      .expect(409);
  });

  // ── Admin view ────────────────────────────────────────────────────────────────

  it('admin vê payment_status e amount_cents nos inscritos', async () => {
    const id = await paidEvent();
    await register(id);

    const res = await request(app.getHttpServer())
      .get(`${BASE}/events/${id}/registrations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body[0]).toHaveProperty('paymentStatus', 'PENDING');
    expect(res.body[0]).toHaveProperty('amountCents', 5248);
  });
});
