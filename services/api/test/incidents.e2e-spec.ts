import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { IncidentSeverity } from '@fonte/types';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('IncidentController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let houseId: string;
  let responsibleId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    ({ token, houseId } = await loginCoordinator(app));

    // Coordinator's own staff id serves as the incident responsible.
    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    responsibleId = me.body.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM incidents');
    await app.close();
  });

  describe('authentication', () => {
    it('GET /incidents → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/incidents`).expect(401));
  });

  describe('validation', () => {
    it('POST /incidents → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400));

    it('POST /incidents → 400 for an invalid severity', () =>
      request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-06-01', severity: 'NONSENSE', description: 'x', houseId, responsibleId })
        .expect(400));
  });

  describe('create & list', () => {
    let incidentId: string;

    it('creates an incident', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-06-01',
          severity: IncidentSeverity.LOW,
          description: 'Discussão no refeitório',
          houseId,
          responsibleId,
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
      incidentId = res.body.id;
    });

    it('lists incidents', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches a single incident', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('GET /incidents/:id → 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/incidents/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));

    it('exposes no DELETE route (incidents are immutable)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`${BASE}/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404); // route does not exist
    });
  });
});
