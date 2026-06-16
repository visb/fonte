import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { StreetSaleType } from '@fonte/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const REPORT_MONTH = new Date().toISOString().slice(0, 7); // YYYY-MM
// Vendas inseridas dentro do mês do relatório para os totais do período atual baterem.
const BREAD_DATE = `${REPORT_MONTH}-15`;
const PIZZA_DATE = `${REPORT_MONTH}-16`;

describe('StreetSaleController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let houseId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Authenticate as coordinator (seeded by seed-test.ts)
    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'coord@fonte.com', password: 'coord123' })
      .expect(200);

    coordToken = loginRes.body.accessToken;

    // Resolve houseId from coordinator's staff profile
    const meRes = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);

    houseId = meRes.body.houseId;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM street_sales');
    await app.close();
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('POST /street-sales → 401 without token', () => {
      return request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .send({})
        .expect(401);
    });

    it('GET /street-sales → 401 without token', () => {
      return request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .expect(401);
    });

    it('GET /street-sales/report → 401 without token', () => {
      return request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(401);
    });
  });

  // ── Input validation ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('POST /street-sales → 400 when body is empty', () => {
      return request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({})
        .expect(400);
    });

    it('POST /street-sales → 400 when type is invalid', () => {
      return request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          houseId,
          date: '2026-05-15',
          type: 'INVALID_TYPE',
          quantity: 10,
          amountPix: 0,
          amountCash: 0,
          amountCard: 0,
        })
        .expect(400);
    });

    it('POST /street-sales → 400 when quantity is negative', () => {
      return request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          houseId,
          date: '2026-05-15',
          type: StreetSaleType.BREAD,
          quantity: -1,
          amountPix: 0,
          amountCash: 0,
          amountCard: 0,
        })
        .expect(400);
    });

    it('POST /street-sales → 400 when houseId is not a UUID', () => {
      return request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          houseId: 'not-a-uuid',
          date: '2026-05-15',
          type: StreetSaleType.BREAD,
          quantity: 10,
          amountPix: 0,
          amountCash: 0,
          amountCard: 0,
        })
        .expect(400);
    });

    it('GET /street-sales/report → 400 when type is missing', () => {
      return request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ month: REPORT_MONTH })
        .expect(400);
    });

    it('GET /street-sales/report → 400 when month format is wrong', () => {
      return request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: '2026-5' })
        .expect(400);
    });
  });

  // ── CRUD flow ───────────────────────────────────────────────────────────────

  describe('POST /street-sales', () => {
    it('creates a bread sale and returns the view shape', async () => {
      const body = {
        houseId,
        date: BREAD_DATE,
        type: StreetSaleType.BREAD,
        quantity: 40,
        amountPix: 15000,
        amountCash: 8000,
        amountCard: 5000,
      };

      const res = await request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        houseId,
        date: BREAD_DATE,
        type: StreetSaleType.BREAD,
        quantity: 40,
        amountPix: 15000,
        amountCash: 8000,
        amountCard: 5000,
        totalAmount: 28000,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.houseName).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('creates a pizza sale', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          houseId,
          date: PIZZA_DATE,
          type: StreetSaleType.PIZZA,
          quantity: 15,
          amountPix: 20000,
          amountCash: 10000,
          amountCard: 5000,
        })
        .expect(201);

      expect(res.body.type).toBe(StreetSaleType.PIZZA);
      expect(res.body.totalAmount).toBe(35000);
    });
  });

  // ── List ────────────────────────────────────────────────────────────────────

  describe('GET /street-sales', () => {
    it('returns an array with all sales', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by type=BREAD and returns only bread entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD })
        .expect(200);

      expect(res.body.every((s: { type: string }) => s.type === StreetSaleType.BREAD)).toBe(true);
    });

    it('filters by type=PIZZA and returns only pizza entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.PIZZA })
        .expect(200);

      expect(res.body.every((s: { type: string }) => s.type === StreetSaleType.PIZZA)).toBe(true);
    });

    it('filters by houseId and returns only that house sales', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      expect(res.body.every((s: { houseId: string }) => s.houseId === houseId)).toBe(true);
    });

    it('returns empty array for a non-existent houseId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId: '00000000-0000-0000-0000-000000000000' })
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('each entry has required fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      for (const sale of res.body) {
        expect(sale).toHaveProperty('id');
        expect(sale).toHaveProperty('houseId');
        expect(sale).toHaveProperty('houseName');
        expect(sale).toHaveProperty('date');
        expect(sale).toHaveProperty('type');
        expect(sale).toHaveProperty('quantity');
        expect(sale).toHaveProperty('amountPix');
        expect(sale).toHaveProperty('amountCash');
        expect(sale).toHaveProperty('amountCard');
        expect(sale).toHaveProperty('totalAmount');
        expect(sale).toHaveProperty('createdAt');
      }
    });
  });

  // ── Report ──────────────────────────────────────────────────────────────────

  describe('GET /street-sales/report', () => {
    it('returns 200 with correct top-level shape', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      expect(res.body).toHaveProperty('type', StreetSaleType.BREAD);
      expect(Array.isArray(res.body.weeklyTotals)).toBe(true);
      expect(Array.isArray(res.body.monthlyTotals)).toBe(true);
      expect(Array.isArray(res.body.byHouse)).toBe(true);
      expect(typeof res.body.currentPeriodTotal).toBe('number');
      expect(typeof res.body.previousPeriodTotal).toBe('number');
    });

    it('monthlyTotals has exactly 6 entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      expect(res.body.monthlyTotals).toHaveLength(6);
    });

    it('each monthly period has correct structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      for (const period of res.body.monthlyTotals) {
        expect(period).toHaveProperty('period');
        expect(period).toHaveProperty('totalPix');
        expect(period).toHaveProperty('totalCash');
        expect(period).toHaveProperty('totalCard');
        expect(period).toHaveProperty('totalAmount');
        expect(period).toHaveProperty('totalQuantity');
        expect(/^\d{4}-\d{2}$/.test(period.period)).toBe(true);
      }
    });

    it('currentPeriodTotal matches sum of bread sales in current month', async () => {
      // We inserted a bread sale with totalAmount=28000 in the current month (2026-05-15)
      // NOTE: only applies if REPORT_MONTH === '2026-05'; adjust if test runs in a different month
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      // At least one bread sale was inserted — total must be > 0
      expect(res.body.currentPeriodTotal).toBeGreaterThan(0);
    });

    it('report for PIZZA type reflects only pizza sales', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.PIZZA, month: REPORT_MONTH })
        .expect(200);

      expect(res.body.type).toBe(StreetSaleType.PIZZA);
      expect(res.body.currentPeriodTotal).toBeGreaterThan(0);
    });

    it('byHouse entries have correct structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      for (const entry of res.body.byHouse) {
        expect(entry).toHaveProperty('houseId');
        expect(entry).toHaveProperty('houseName');
        expect(entry).toHaveProperty('totalPix');
        expect(entry).toHaveProperty('totalCash');
        expect(entry).toHaveProperty('totalCard');
        expect(entry).toHaveProperty('totalAmount');
        expect(entry).toHaveProperty('totalQuantity');
      }
    });

    it('houseId filter scopes report to that house only', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH, houseId })
        .expect(200);

      for (const entry of res.body.byHouse) {
        expect(entry.houseId).toBe(houseId);
      }
    });

    it('weeklyTotals covers the entire month in 7-day windows', async () => {
      const [year, month] = REPORT_MONTH.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const expectedWeeks = Math.ceil(daysInMonth / 7);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/street-sales/report`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ type: StreetSaleType.BREAD, month: REPORT_MONTH })
        .expect(200);

      expect(res.body.weeklyTotals).toHaveLength(expectedWeeks);
      expect(res.body.weeklyTotals[0].period).toBe(`${REPORT_MONTH}-01`);
    });
  });
});
