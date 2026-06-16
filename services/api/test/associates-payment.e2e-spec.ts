import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';
import { ABACATEPAY_CLIENT } from '../src/modules/associate/abacatepay/abacatepay.types';

/**
 * E2E do checkout público + webhook AbacatePay (story 38). O gateway é mockado
 * via override do provider ABACATEPAY_CLIENT — a API real nunca é chamada (sem
 * chave). Cobre: GET público (token válido/inválido), subscribe (gross-up + 1ª
 * charge PENDING), webhook (transição de status + idempotência).
 */
describe('Associates payment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let createSubscription: jest.Mock;

  const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET ?? 'test_webhook_secret';

  let seq = 0;

  beforeAll(async () => {
    // Cada subscribe recebe ids únicos do "gateway" (o índice único parcial em
    // abacatepay_charge_id rejeitaria ids repetidos entre associados distintos).
    createSubscription = jest.fn().mockImplementation(() => {
      seq += 1;
      return Promise.resolve({
        subscriptionId: `sub_e2e_${seq}`,
        chargeId: `chg_e2e_${seq}`,
        checkoutUrl: 'https://pay/e2e',
      });
    });
    const gatewayMock = {
      createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_e2e' }),
      createSubscription,
      cancelSubscription: jest.fn().mockResolvedValue({ canceled: true }),
    };

    app = await bootstrapApp({
      overrideProvider: { token: ABACATEPAY_CLIENT, useValue: gatewayMock },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM associate_charges');
    await dataSource.query('DELETE FROM associate_subscriptions');
    await dataSource.query('DELETE FROM associates');
    await app.close();
  });

  async function createAssociate(): Promise<{ id: string; token: string }> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/associates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Public Doador', whatsapp: '+5562988887777', contributionAmount: 50, dueDay: 10 })
      .expect(201);
    return { id: res.body.id, token: res.body.paymentToken };
  }

  describe('GET /public/associates/:token', () => {
    it('returns minimal public view for a valid token', async () => {
      const { token } = await createAssociate();
      const res = await request(app.getHttpServer())
        .get(`${BASE}/public/associates/${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Public Doador',
        suggestedAmount: 50,
        dueDay: 10,
        status: 'PENDING',
        hasActiveSubscription: false,
      });
      // não vaza dados sensíveis
      expect(res.body).not.toHaveProperty('whatsapp');
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('paymentToken');
    });

    it('404 for an unknown token', () =>
      request(app.getHttpServer())
        .get(`${BASE}/public/associates/00000000-0000-0000-0000-000000000000`)
        .expect(404));
  });

  describe('POST /public/associates/:token/subscribe', () => {
    it('creates subscription + PENDING charge with gross-up', async () => {
      const { token } = await createAssociate();
      const res = await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ contributionAmount: 50, cardToken: 'tok_e2e' })
        .expect(201);

      expect(res.body.subscription.netAmount).toBe(50);
      expect(res.body.subscription.grossAmount).toBe(52.44);
      expect(res.body.subscription.feeAmount).toBe(2.44);
      expect(res.body.charge.status).toBe('PENDING');
      expect(res.body.checkoutUrl).toBe('https://pay/e2e');
      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ grossAmount: 52.44, cardToken: 'tok_e2e' }),
      );
    });

    it('400 when cardToken is missing', async () => {
      const { token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ contributionAmount: 50 })
        .expect(400);
    });
  });

  describe('POST /webhooks/abacatepay', () => {
    it('401 with wrong secret', () =>
      request(app.getHttpServer())
        .post(`${BASE}/webhooks/abacatepay?webhookSecret=wrong`)
        .send({ event: 'subscription.completed', data: {} })
        .expect(401));

    it('marks charge PAID + associate ACTIVE on paid event (idempotent)', async () => {
      const { id, token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ contributionAmount: 50, cardToken: 'tok' })
        .expect(201);

      // Sem chargeId/subscriptionId do gateway: resolve pelo externalId (associate id);
      // markPaid usa a cobrança PENDING mais recente da assinatura.
      const paidBody = {
        event: 'subscription.completed',
        data: { externalId: id },
      };

      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`)
        .send(paidBody)
        .expect(200);

      // segunda entrega do mesmo evento = idempotente
      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`)
        .send(paidBody)
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`${BASE}/associates/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.status).toBe('ACTIVE');
      expect(detail.body.subscription.status).toBe('ACTIVE');
      const paid = detail.body.charges.filter((c: { status: string }) => c.status === 'PAID');
      expect(paid).toHaveLength(1);
    });

    it('marks subscription/associate CANCELED on cancel event', async () => {
      const { id, token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ contributionAmount: 50, cardToken: 'tok' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`)
        .send({ event: 'subscription.cancelled', data: { externalId: id } })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`${BASE}/associates/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.status).toBe('CANCELED');
      expect(detail.body.subscription.status).toBe('CANCELED');
    });
  });
});
