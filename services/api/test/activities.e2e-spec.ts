import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ActivityStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('ActivityController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let coordHouseId: string;
  let coordStaffId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId: coordHouseId } = await loginCoordinator(app));

    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    coordStaffId = me.body.id;

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM activities');
    await app.close();
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authentication', () => {
    it('GET /activities → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/activities`).expect(401));
  });

  describe('validation', () => {
    it('POST /activities → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({})
        .expect(400));
  });

  // ── ops (coordinator) flow ──────────────────────────────────────────────────

  describe('ops flow: draft → requested', () => {
    let activityId: string;

    it('coordinator creates a draft (forced to DRAFT)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Trocar lâmpada do corredor', houseId: coordHouseId })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ActivityStatus.DRAFT);
      activityId = res.body.id;
    });

    it('coordinator submits its own draft (DRAFT → REQUESTED)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.REQUESTED);
    });

    it('coordinator cannot approve a request (REQUESTED → TODO is ADMIN only) → 403', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.TODO, responsibleStaffId: coordStaffId })
        .expect(403));

    it('admin approves the request and assigns a responsible (REQUESTED → TODO)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ActivityStatus.TODO, responsibleStaffId: coordStaffId })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.TODO);
      expect(res.body.responsibleStaffId).toBe(coordStaffId);
    });

    it('responsible coordinator moves the card (TODO → DOING)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.DOING })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.DOING);
    });

    it('rejects an invalid transition (DOING → REQUESTED) → 400', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(400));
  });

  // ── admin flow / scoping ────────────────────────────────────────────────────

  describe('admin create in TODO requires a responsible', () => {
    it('admin POST in TODO without responsible → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Direto a fazer', status: ActivityStatus.TODO })
        .expect(400));

    it('admin POST in TODO with responsible → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Direto a fazer',
          status: ActivityStatus.TODO,
          houseId: coordHouseId,
          responsibleStaffId: coordStaffId,
        })
        .expect(201);
      expect(res.body.status).toBe(ActivityStatus.TODO);
    });
  });

  describe('scoping', () => {
    let houselessId: string;

    it('admin creates a houseless draft', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Atividade geral (sem casa)' })
        .expect(201);
      houselessId = res.body.id;
    });

    it('coordinator does not see the houseless activity in the list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a: { id: string }) => a.id === houselessId)).toBe(false);
      // but only sees its own house
      expect(res.body.every((a: { houseId: string }) => a.houseId === coordHouseId)).toBe(true);
    });

    it('coordinator gets 404 fetching a houseless activity', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(404));

    it('admin sees the houseless activity', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200));
  });

  describe('delete', () => {
    it('coordinator cannot delete a non-draft activity → 403', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Para enviar e tentar deletar', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`${BASE}/activities/${created.body.id}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403);
    });

    it('coordinator deletes its own draft → 204', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Rascunho a apagar', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204);
    });

    it('admin deletes any activity → 204', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin apaga', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });
});
