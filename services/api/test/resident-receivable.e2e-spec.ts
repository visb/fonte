import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { FamilyInvestment, PaymentMethod, ReceivableStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('Resident receivables (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  let residentId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const today = new Date().toISOString().slice(0, 10);
    const created = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Pagador E2E ${Date.now()}`,
        houseId,
        entryDate: today,
        familyInvestment: FamilyInvestment.PAYMENT_700,
        contributionDueDay: 10,
      })
      .expect(201);
    residentId = created.body.id;
  });

  afterAll(async () => {
    await request(app.getHttpServer()).delete(`${BASE}/residents/${residentId}`).set('Authorization', `Bearer ${adminToken}`);
    await app.close();
  });

  describe('authentication', () => {
    it('GET receivables → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/residents/${residentId}/receivables`).expect(401));
  });

  describe('schedule generation', () => {
    it('materializes the 6 mandatory installments of R$700', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const mandatory = res.body.filter((r: { mandatory: boolean }) => r.mandatory);
      expect(mandatory).toHaveLength(6);
      expect(mandatory.every((r: { amount: number }) => r.amount === 700)).toBe(true);
    });
  });

  describe('payment lifecycle', () => {
    let receivableId: string;

    it('registers a payment', async () => {
      const list = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      receivableId = list.body[0].id;

      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAt: new Date().toISOString().slice(0, 10), paymentMethod: PaymentMethod.PIX, notes: 'pix recebido' })
        .expect(201);
      expect(res.body.status).toBe(ReceivableStatus.PAID);
    });

    it('400 when paidAt is missing', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethod: PaymentMethod.PIX })
        .expect(400));

    it('reopens the payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/reopen`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(res.body.status).toBe(ReceivableStatus.PENDING);
    });
  });

  describe('contribution plan changes', () => {
    it('reprices future pending after switching to a NEGOTIATED plan', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/residents/${residentId}/contribution-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ familyInvestment: FamilyInvestment.NEGOTIATED, familyInvestmentAmount: 350 })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const today = new Date();
      const firstFutureMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const future = res.body.filter(
        (r: { referenceMonth: string; status: string }) =>
          r.referenceMonth >= firstFutureMonth && r.status === ReceivableStatus.PENDING,
      );
      expect(future.every((r: { amount: number }) => r.amount === 350)).toBe(true);
    });

    it('cancels future pending when marked exempt', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/residents/${residentId}/contribution-exempt`)
        .set('Authorization', `Bearer ${token}`)
        .send({ exempt: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const today = new Date();
      const firstFutureMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const futurePending = res.body.filter(
        (r: { referenceMonth: string; status: string }) =>
          r.referenceMonth >= firstFutureMonth && r.status === ReceivableStatus.PENDING,
      );
      expect(futurePending).toHaveLength(0);
    });
  });
});
