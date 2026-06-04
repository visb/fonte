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
  });
});
