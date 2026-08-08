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

// Story 164 — o carnê passa a saber a que acolhimento cada parcela pertence.
describe('Resident receivables por acolhimento (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  let residentId: string;
  let firstAdmissionId: string;
  let currentAdmissionId: string;

  const OLD_ENTRY = '2023-01-05';
  const OLD_EXIT = '2023-08-05';
  const NEW_ENTRY = '2026-02-10';

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const created = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Reacolhido E2E ${Date.now()}`,
        houseId,
        entryDate: OLD_ENTRY,
        familyInvestment: FamilyInvestment.PAYMENT_700,
        contributionDueDay: 10,
      })
      .expect(201);
    residentId = created.body.id;

    // Encerra o primeiro acolhimento e reintroduz com outro plano.
    await request(app.getHttpServer())
      .patch(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISCHARGED', exitDate: OLD_EXIT })
      .expect(200);

    await request(app.getHttpServer())
      .post(`${BASE}/residents/${residentId}/readmit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        houseId,
        entryDate: NEW_ENTRY,
        familyInvestment: FamilyInvestment.BASKET_500,
        contributionDueDay: 10,
      })
      .expect(201);
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .delete(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    await app.close();
  });

  it('GET admissions devolve do acolhimento mais recente ao mais antigo', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/admissions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const entries = res.body.map((a: { entryDate: string }) => String(a.entryDate).slice(0, 10));
    expect(entries).toEqual([NEW_ENTRY, OLD_ENTRY]);

    currentAdmissionId = res.body[0].id;
    firstAdmissionId = res.body[1].id;
  });

  it('GET receivables devolve admissionId em toda parcela, separando os acolhimentos', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/receivables`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const items = res.body as {
      referenceMonth: string;
      admissionId: string | null;
      familyInvestment: string;
    }[];
    expect(items.length).toBeGreaterThan(6);
    expect(items.every((r) => r.admissionId != null)).toBe(true);

    const firstMonthOfNewAdmission = `${NEW_ENTRY.slice(0, 7)}-01`;
    const old = items.filter((r) => r.referenceMonth < firstMonthOfNewAdmission);
    const current = items.filter((r) => r.referenceMonth >= firstMonthOfNewAdmission);

    expect(old).toHaveLength(6);
    expect(old.every((r) => r.admissionId === firstAdmissionId)).toBe(true);
    expect(old.every((r) => r.familyInvestment === FamilyInvestment.PAYMENT_700)).toBe(true);

    expect(current.length).toBeGreaterThan(0);
    expect(current.every((r) => r.admissionId === currentAdmissionId)).toBe(true);
    expect(current.every((r) => r.familyInvestment === FamilyInvestment.BASKET_500)).toBe(true);
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
