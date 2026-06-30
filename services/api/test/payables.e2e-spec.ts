import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('PayableController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken } = await loginCoordinator(app));
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM payables');
    await app.close();
  });

  // dueDate is kept in the future relative to "now" so the `overdue` flag is
  // deterministically false regardless of the wall clock (avoids a date-bomb as
  // time passes the hardcoded date).
  const futureDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  const validBody = () => ({
    description: 'Conta de luz',
    amount: 25000,
    dueDate: futureDueDate(),
    category: 'UTILITIES',
    supplier: 'Enel',
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authorization', () => {
    it('POST /payables → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/payables`).send(validBody()).expect(401));

    it('GET /payables → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/payables`).expect(401));

    it('POST /payables → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(validBody())
        .expect(403));

    it('GET /payables → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/payables`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));

    it('GET /payables/summary → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/payables/summary`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('400 when amount is negative', () =>
      request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), amount: -1 })
        .expect(400));

    it('400 when category is not a valid enum', () =>
      request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), category: 'NOPE' })
        .expect(400));

    it('400 when dueDate is not a date string', () =>
      request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), dueDate: 'not-a-date' })
        .expect(400));
  });

  // ── CRUD + pay + summary ──────────────────────────────────────────────────────

  describe('CRUD flow', () => {
    let createdId: string;

    it('creates a payable with OPEN status', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('OPEN');
      expect(res.body.amount).toBe(25000);
      expect(res.body.paidAt).toBeNull();
      expect(res.body.overdue).toBe(false);
      createdId = res.body.id;
    });

    it('lists payables (array) and supports status filter', async () => {
      const all = await request(app.getHttpServer())
        .get(`${BASE}/payables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(all.body)).toBe(true);
      expect(all.body.length).toBeGreaterThanOrEqual(1);

      const open = await request(app.getHttpServer())
        .get(`${BASE}/payables?status=OPEN`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(open.body.every((p: { status: string }) => p.status === 'OPEN')).toBe(true);

      const paid = await request(app.getHttpServer())
        .get(`${BASE}/payables?status=PAID`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(paid.body.every((p: { status: string }) => p.status === 'PAID')).toBe(true);
    });

    it('returns a summary with open/paid/overdue totals', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/payables/summary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalOpen');
      expect(res.body).toHaveProperty('totalPaid');
      expect(res.body).toHaveProperty('totalOverdue');
      expect(res.body.totalOpen).toBeGreaterThanOrEqual(25000);
    });

    it('gets one payable by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/payables/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.id).toBe(createdId);
    });

    it('404 for unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/payables/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));

    it('updates a payable (partial)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/payables/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 30000, supplier: 'CELG' })
        .expect(200);
      expect(res.body.amount).toBe(30000);
      expect(res.body.supplier).toBe('CELG');
    });

    it('marks a payable as paid (OPEN → PAID, sets paid_at)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/payables/${createdId}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paidAt: '2026-06-15' })
        .expect(200);
      expect(res.body.status).toBe('PAID');
      expect(res.body.paidAt).toBe('2026-06-15');
    });

    it('400 when paying an already-paid payable', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/payables/${createdId}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('soft deletes a payable (then 404 on get)', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/payables/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`${BASE}/payables/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
