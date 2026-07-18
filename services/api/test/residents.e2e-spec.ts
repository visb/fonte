import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ResidentStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('ResidentController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app.getHttpServer()).delete(`${BASE}/residents/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('authentication', () => {
    it('GET /residents → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/residents`).expect(401));
  });

  describe('list & filters', () => {
    it('returns the paginated envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by houseId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ houseId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.every((r: { houseId: string }) => r.houseId === houseId)).toBe(true);
    });

    it('filters by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ status: ResidentStatus.ACTIVE })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.every((r: { status: string }) => r.status === ResidentStatus.ACTIVE)).toBe(true);
    });

    it('filters by search term', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ search: 'Testador' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('accepts the overdueContribution flag', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ overdueContribution: 'true' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200));

    it('GET /residents → 400 for an invalid status enum', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ status: 'NONSENSE' })
        .set('Authorization', `Bearer ${token}`)
        .expect(400));
  });

  // ─── Ordenação (story 129) ───────────────────────────────────────────────
  describe('sorting', () => {
    const tag = `Ordena ${Date.now()}`;
    const sameDate = '2019-03-15';

    beforeAll(async () => {
      // Três filhos com datas de entrada distintas para provar a ordem, mais
      // dois com a MESMA data para provar a estabilidade da paginação.
      const fixtures = [
        { name: `${tag} A`, entryDate: '2020-01-10' },
        { name: `${tag} B`, entryDate: '2021-06-20' },
        { name: `${tag} C`, entryDate: '2022-12-01' },
        { name: `${tag} D`, entryDate: sameDate },
        { name: `${tag} E`, entryDate: sameDate },
        { name: `${tag} F`, entryDate: sameDate },
      ];
      for (const f of fixtures) {
        const res = await request(app.getHttpServer())
          .post(`${BASE}/residents`)
          .set('Authorization', `Bearer ${token}`)
          .send({ ...f, houseId })
          .expect(201);
        createdIds.push(res.body.id);
      }
    });

    it('GET /residents?sort=entryDate&order=desc returns rows in descending entry_date order', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ sort: 'entryDate', order: 'desc', search: tag, limit: 100 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const dates: string[] = res.body.data
        .map((r: { entryDate: string | null }) => r.entryDate)
        .filter((d: string | null): d is string => d != null);
      expect(dates.length).toBeGreaterThanOrEqual(3);
      const sorted = [...dates].sort((a, b) => b.localeCompare(a));
      expect(dates).toEqual(sorted);
    });

    it('GET /residents?sort=entryDate&order=asc returns rows in ascending entry_date order', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ sort: 'entryDate', order: 'asc', search: tag, limit: 100 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const dates: string[] = res.body.data
        .map((r: { entryDate: string | null }) => r.entryDate)
        .filter((d: string | null): d is string => d != null);
      const sorted = [...dates].sort((a, b) => a.localeCompare(b));
      expect(dates).toEqual(sorted);
    });

    it('GET /residents → 400 for a sort column outside the whitelist (SQL injection guard)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ sort: 'name;DROP TABLE resident' })
        .set('Authorization', `Bearer ${token}`)
        .expect(400));

    it('GET /residents → 400 for an order value outside the whitelist', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ sort: 'name', order: 'sideways' })
        .set('Authorization', `Bearer ${token}`)
        .expect(400));

    it('paginates stably across repeated entry_date values (no repeats, no skips)', async () => {
      const fetchPage = (page: number) =>
        request(app.getHttpServer())
          .get(`${BASE}/residents`)
          .query({ sort: 'entryDate', order: 'desc', search: `${tag} `, limit: 2, page })
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
          .then((r) => r.body.data as Array<{ id: string }>);

      const [p1, p2, p3] = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)]);
      const ids = [...p1, ...p2, ...p3].map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length); // sem repetição entre páginas
      // As 6 fixtures (D/E/F com data repetida) devem ser cobertas sem pulos.
      const seen = new Set(ids);
      const created = createdIds.filter((_id, i) => i >= createdIds.length - 6);
      expect(created.every((id) => seen.has(id))).toBe(true);
    });
  });

  describe('CRUD', () => {
    it('POST /residents → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400));

    it('creates and updates a resident', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Filho E2E ${Date.now()}`, houseId })
        .expect(201);
      expect(created.body.id).toBeDefined();
      createdIds.push(created.body.id);

      const updated = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ occupation: 'Pedreiro' })
        .expect(200);
      expect(updated.body.occupation).toBe('Pedreiro');
    });

    it('GET /residents/:id → 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));

    it('PATCH /residents/:id { status: ACTIVE } is accepted without any signed documents', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Filho Docs Opcionais ${Date.now()}`, houseId, status: ResidentStatus.PRE_ADMISSION })
        .expect(201);
      createdIds.push(created.body.id);

      const updated = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ResidentStatus.ACTIVE })
        .expect(200);
      expect(updated.body.status).toBe(ResidentStatus.ACTIVE);
    });
  });
});
