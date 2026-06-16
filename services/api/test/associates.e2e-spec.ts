import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('AssociateController (e2e)', () => {
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
    await dataSource.query('DELETE FROM associates');
    await app.close();
  });

  const validBody = () => ({
    name: 'João Doador',
    whatsapp: '+5562999998888',
    email: 'joao@example.com',
    contributionAmount: 50,
    dueDay: 10,
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authorization', () => {
    it('POST /associates → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/associates`).send(validBody()).expect(401));

    it('GET /associates → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/associates`).expect(401));

    it('POST /associates → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(validBody())
        .expect(403));

    it('GET /associates → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('400 when whatsapp is not E.164', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), whatsapp: '62999998888' })
        .expect(400));

    it('400 when contributionAmount is not positive', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), contributionAmount: 0 })
        .expect(400));

    it('400 when dueDay is out of range', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), dueDay: 32 })
        .expect(400));

    it('400 when email is invalid', () =>
      request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), email: 'not-an-email' })
        .expect(400));
  });

  // ── Overview ──────────────────────────────────────────────────────────────────

  describe('overview', () => {
    it('GET /associates/overview → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/associates/overview`).expect(401));

    it('GET /associates/overview → 403 for non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/overview`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));

    it('returns the overview shape with the default 12 months', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates/overview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.months)).toBe(true);
      expect(res.body.months).toHaveLength(12);
      for (const m of res.body.months) {
        expect(m).toHaveProperty('month');
        expect(m).toHaveProperty('expectedGross');
        expect(m).toHaveProperty('collectedNet');
      }
      expect(res.body.current).toHaveProperty('newAssociates');
      expect(res.body.current).toHaveProperty('churnRate');
      expect(res.body.current).toHaveProperty('recurrenceRate');
      expect(res.body.current).toHaveProperty('delinquentCharges');
    });

    it('honors the months query param', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates/overview?months=3`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.months).toHaveLength(3);
    });
  });

  // ── CRUD flow ───────────────────────────────────────────────────────────────

  describe('CRUD', () => {
    let createdId: string;

    it('creates an associate with payment_token and PENDING status', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
      expect(res.body.paymentToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(res.body.contributionAmount).toBe(50);
      expect(res.body.dueDay).toBe(10);
      createdId = res.body.id;
    });

    it('accepts an associate without email', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Sem Email', whatsapp: '+5511988887777', contributionAmount: 30, dueDay: 5 })
        .expect(201);
      expect(res.body.email).toBeNull();
    });

    it('lists associates with lastCharge field', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      for (const a of res.body) {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('status');
        expect(a).toHaveProperty('paymentToken');
        expect(a).toHaveProperty('lastCharge');
      }
    });

    it('gets one associate with subscription + charges', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdId);
      expect(res.body.subscription).toBeNull();
      expect(Array.isArray(res.body.charges)).toBe(true);
    });

    it('404 for unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));

    it('updates an associate', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/associates/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'João Atualizado', dueDay: 20 })
        .expect(200);

      expect(res.body.name).toBe('João Atualizado');
      expect(res.body.dueDay).toBe(20);
    });

    it('soft deletes an associate (then 404 on get)', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/associates/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`${BASE}/associates/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
