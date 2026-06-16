import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';
process.env.PAGARME_WEBHOOK_USER = process.env.PAGARME_WEBHOOK_USER ?? 'hookuser';
process.env.PAGARME_WEBHOOK_PASSWORD = process.env.PAGARME_WEBHOOK_PASSWORD ?? 'hookpass';
// Taxas determinísticas para o gross-up do teste (50 → 52.44 com 3,5% + R$0,60).
process.env.PAGARME_CARD_FEE_PCT = '0.035';
process.env.PAGARME_CARD_FEE_FIXED = '0.60';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { PAYMENT_GATEWAY } from '../src/modules/associate/gateway/gateway.types';

/**
 * E2E do checkout público + webhook Pagar.me (story 41). O gateway é mockado via
 * override do provider PAYMENT_GATEWAY — a API real nunca é chamada (sem chave).
 * Cobre: GET público (token válido/inválido), subscribe (valor FIXO + gross-up +
 * 1ª charge PENDING), webhook (transição + idempotência) e cancelamento (ADMIN/403).
 */
describe('Associates payment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let createSubscription: jest.Mock;
  let cancelSubscription: jest.Mock;

  const WH_AUTH = `Basic ${Buffer.from(
    `${process.env.PAGARME_WEBHOOK_USER}:${process.env.PAGARME_WEBHOOK_PASSWORD}`,
  ).toString('base64')}`;

  let seq = 0;

  beforeAll(async () => {
    // Cada subscribe recebe ids únicos do "gateway" (o índice único parcial em
    // gateway_charge_id rejeitaria ids repetidos entre associados distintos).
    createSubscription = jest.fn().mockImplementation(() => {
      seq += 1;
      return Promise.resolve({ subscriptionId: `sub_e2e_${seq}`, chargeId: `chg_e2e_${seq}` });
    });
    cancelSubscription = jest.fn().mockResolvedValue({ canceled: true });
    const gatewayMock = {
      createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_e2e' }),
      createSubscription,
      cancelSubscription,
    };

    app = await bootstrapApp({
      overrideProvider: { token: PAYMENT_GATEWAY, useValue: gatewayMock },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken } = await loginCoordinator(app));
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
    it('creates subscription + PENDING charge with gross-up over the fixed amount', async () => {
      const { token } = await createAssociate();
      const res = await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ cardToken: 'tok_e2e' })
        .expect(201);

      expect(res.body.subscription.netAmount).toBe(50);
      expect(res.body.subscription.grossAmount).toBe(52.44);
      expect(res.body.subscription.feeAmount).toBe(2.44);
      expect(res.body.charge.status).toBe('PENDING');
      expect(res.body.checkoutUrl).toBeNull();
      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ grossAmount: 52.44, cardToken: 'tok_e2e', interval: 'month' }),
      );
    });

    it('400 when cardToken is missing', async () => {
      const { token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /webhooks/pagarme', () => {
    it('401 with wrong credentials', () =>
      request(app.getHttpServer())
        .post(`${BASE}/webhooks/pagarme`)
        .set('Authorization', 'Basic wrong')
        .send({ type: 'charge.paid', data: {} })
        .expect(401));

    it('marks charge PAID + associate ACTIVE on charge.paid (idempotent)', async () => {
      const { id, token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ cardToken: 'tok' })
        .expect(201);

      // Resolve a assinatura por metadata.associate_id; markPaid usa a cobrança
      // PENDING mais recente quando o evento não traz o id da cobrança.
      const paidBody = { type: 'charge.paid', data: { metadata: { associate_id: id } } };

      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/pagarme`)
        .set('Authorization', WH_AUTH)
        .send(paidBody)
        .expect(200);

      // segunda entrega = idempotente
      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/pagarme`)
        .set('Authorization', WH_AUTH)
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

    it('marks subscription/associate CANCELED on subscription.canceled', async () => {
      const { id, token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ cardToken: 'tok' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${BASE}/webhooks/pagarme`)
        .set('Authorization', WH_AUTH)
        .send({ type: 'subscription.canceled', data: { metadata: { associate_id: id } } })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`${BASE}/associates/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.status).toBe('CANCELED');
      expect(detail.body.subscription.status).toBe('CANCELED');
    });
  });

  describe('POST /associates/:id/cancel-subscription', () => {
    it('cancels at the gateway and marks CANCELED (ADMIN)', async () => {
      const { id, token } = await createAssociate();
      await request(app.getHttpServer())
        .post(`${BASE}/public/associates/${token}/subscribe`)
        .send({ cardToken: 'tok' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`${BASE}/associates/${id}/cancel-subscription`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.status).toBe('CANCELED');
      expect(cancelSubscription).toHaveBeenCalled();

      const detail = await request(app.getHttpServer())
        .get(`${BASE}/associates/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.status).toBe('CANCELED');
    });

    it('403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates/00000000-0000-0000-0000-000000000000/cancel-subscription`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));
  });
});
