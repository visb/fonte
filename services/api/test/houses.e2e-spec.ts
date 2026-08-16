import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('HouseController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  let dataSource: DataSource;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('authentication', () => {
    it('GET /houses → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/houses`).expect(401));

    it('POST /houses → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/houses`).send({}).expect(401));
  });

  describe('validation', () => {
    it('POST /houses → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('POST /houses → 400 when state is not 2 chars', () =>
      request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', state: 'SAO' })
        .expect(400));
  });

  describe('list & detail', () => {
    it('GET /houses returns the seeded house with counts', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const seeded = res.body.find((h: { id: string }) => h.id === houseId);
      expect(seeded).toBeDefined();
      expect(seeded).toHaveProperty('activeResidentsCount');
      expect(seeded).toHaveProperty('staffCount');
    });

    it('GET /houses/:id → 404 for an unknown house', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));

    it('GET /houses/:id → 400 for a non-uuid', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/not-a-uuid`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400));
  });

  describe('staff da casa (story 181)', () => {
    const PHOTO = '/uploads/staff/e2e-181.jpg';

    it('GET /houses/:id/staff devolve o resumo com photoUrl (null no seed, valor quando há foto)', async () => {
      const before = await request(app.getHttpServer())
        .get(`${BASE}/houses/${houseId}/staff`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(before.body.length).toBeGreaterThan(0);
      // O seed não sobe foto de servo: todos descem com `photoUrl` null — e só
      // com as 4 colunas do resumo (minimização; a rota é lida por SERVANT).
      for (const s of before.body) {
        expect(Object.keys(s).sort()).toEqual(['id', 'name', 'photoUrl', 'whatsapp']);
        expect(s.photoUrl).toBeNull();
      }

      const target = before.body[0];
      await dataSource.query('UPDATE staff SET photo_url = $1 WHERE id = $2', [PHOTO, target.id]);
      try {
        const after = await request(app.getHttpServer())
          .get(`${BASE}/houses/${houseId}/staff`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const withPhoto = after.body.find((s: { id: string }) => s.id === target.id);
        expect(withPhoto).toMatchObject({
          id: target.id,
          name: target.name,
          whatsapp: target.whatsapp,
          photoUrl: PHOTO,
        });
      } finally {
        // Devolve o servo ao estado do seed — a suíte não pode deixar rastro.
        await dataSource.query('UPDATE staff SET photo_url = NULL WHERE id = $1', [target.id]);
      }
    });

    it('GET /houses/:id/staff → 404 para casa inexistente', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/00000000-0000-0000-0000-000000000000/staff`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));
  });

  describe('CRUD', () => {
    it('creates, updates and deletes a house (admin only)', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Casa E2E ${Date.now()}`, generalCapacity: 8, state: 'SP' })
        .expect(201);
      expect(created.body.id).toBeDefined();
      const id = created.body.id;

      const updated = await request(app.getHttpServer())
        .patch(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Casa E2E (renomeada)' })
        .expect(200);
      expect(updated.body.name).toBe('Casa E2E (renomeada)');

      await request(app.getHttpServer())
        .delete(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('POST /houses → 403 for a coordinator (admin-only)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Casa Proibida ${Date.now()}` });
      expect(res.status).toBe(403);
    });
  });
});
