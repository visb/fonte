import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { FamilyInvestment, NotificationType, PaymentMethod, ReceivableStatus, Role } from '@fonte/types';
import { AppModule } from '../src/app.module';
import { NotificationService } from '../src/modules/notification/notification.service';
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

    it('generates a PAYMENT_REGISTERED notification visible to ADMIN', async () => {
      const list = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const payment = list.body.find(
        (n: { type: string; metadata?: { entityId?: string } }) =>
          n.type === NotificationType.PAYMENT_REGISTERED && n.metadata?.entityId === receivableId,
      );
      expect(payment).toBeDefined();
      expect(payment.recipientRole).toBe(Role.ADMIN);
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

  describe('payment with diverging modality and amount', () => {
    it('persists paidAmount/paidFamilyInvestment when out of the plan default', async () => {
      const list = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      // Pick a still-pending installment (the first one was reopened above).
      const target = list.body.find(
        (r: { status: string }) => r.status === ReceivableStatus.PENDING,
      );
      expect(target).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${target.id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          paidAt: new Date().toISOString().slice(0, 10),
          paymentMethod: PaymentMethod.CASH,
          paidAmount: 250,
          paidFamilyInvestment: FamilyInvestment.NEGOTIATED,
        })
        .expect(201);

      expect(res.body.status).toBe(ReceivableStatus.PAID);
      expect(res.body.paidAmount).toBe(250);
      expect(res.body.paidFamilyInvestment).toBe(FamilyInvestment.NEGOTIATED);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const persisted = after.body.find((r: { id: string }) => r.id === target.id);
      expect(persisted.paidAmount).toBe(250);
      expect(persisted.paidFamilyInvestment).toBe(FamilyInvestment.NEGOTIATED);
    });

    it('defaults paidAmount/paidFamilyInvestment to the snapshot when omitted', async () => {
      const list = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const target = list.body.find(
        (r: { status: string }) => r.status === ReceivableStatus.PENDING,
      );
      expect(target).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${target.id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAt: new Date().toISOString().slice(0, 10), paymentMethod: PaymentMethod.PIX })
        .expect(201);

      expect(res.body.paidAmount).toBe(target.amount);
      expect(res.body.paidFamilyInvestment).toBe(target.familyInvestment);
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

describe('Payment notification is best-effort (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  let residentId: string;

  beforeAll(async () => {
    // Boot a dedicated app where the notification create throws, to prove the
    // payment still succeeds when the notification side-effect fails.
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NotificationService)
      .useValue({
        create: jest.fn().mockRejectedValue(new Error('notification down')),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const today = new Date().toISOString().slice(0, 10);
    const created = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Best Effort ${Date.now()}`,
        houseId,
        entryDate: today,
        familyInvestment: FamilyInvestment.PAYMENT_700,
        contributionDueDay: 10,
      })
      .expect(201);
    residentId = created.body.id;
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    await app.close();
  });

  it('still registers the payment when the notification emission throws', async () => {
    const list = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/receivables`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const receivableId = list.body[0].id;

    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paidAt: new Date().toISOString().slice(0, 10), paymentMethod: PaymentMethod.PIX })
      .expect(201);

    expect(res.body.status).toBe(ReceivableStatus.PAID);
  });
});
