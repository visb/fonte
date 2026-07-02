import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Role } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('StaffController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app.getHttpServer()).delete(`${BASE}/staff/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('authentication & authorization', () => {
    it('GET /staff → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/staff`).expect(401));

    it('POST /staff → 403 for a coordinator (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: 'X', password: 'secret123', role: Role.SERVANT });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /staff/me', () => {
    it('returns the coordinator profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.houseId).toBeDefined();
    });
  });

  describe('validation', () => {
    it('POST /staff → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('POST /staff → 400 for a too-short password', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', password: '123', role: Role.SERVANT })
        .expect(400));

    // Story 96 — campos clínicos/de tratamento foram removidos do DTO. Com
    // forbidNonWhitelisted, enviá-los deve resultar em 400.
    it('POST /staff → 400 when sending a removed treatment field', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Y', password: 'secret123', role: Role.SERVANT, addiction: 'Álcool' })
        .expect(400));
  });

  describe('CRUD', () => {
    it('creates a servant WITHOUT email (e-mail opcional)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Servo Sem Email ${Date.now()}`, password: 'secret123', role: Role.SERVANT, rank: 'ASPIRANTE' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('creates a servant with personal fields but no clinical/treatment fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Servo Ficha ${Date.now()}`,
          password: 'secret123',
          role: Role.SERVANT,
          cpf: '123.456.789-00',
          occupation: 'Auxiliar',
        })
        .expect(201);
      createdIds.push(res.body.id);
      expect(res.body.cpf).toBe('123.456.789-00');
      expect(res.body.occupation).toBe('Auxiliar');
      expect(res.body).not.toHaveProperty('addiction');
      expect(res.body).not.toHaveProperty('healthIssues');
      expect(res.body).not.toHaveProperty('continuousMedication');
      expect(res.body).not.toHaveProperty('weight');
      expect(res.body).not.toHaveProperty('height');
    });

    it('creates a servant WITH email, then rejects the duplicate', async () => {
      const email = `servo-${Date.now()}@fonte.com`;
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Servo Com Email', email, password: 'secret123', role: Role.SERVANT })
        .expect(201);
      createdIds.push(res.body.id);

      await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Outro', email, password: 'secret123', role: Role.SERVANT })
        .expect(409);
    });

    it('updates a staff name', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Servo Renomeado' })
        .expect(200);
      expect(res.body.name).toBe('Servo Renomeado');
    });

    it('GET /staff/:id → 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/staff/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));
  });
});
