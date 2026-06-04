import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('SupportGroupController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await login(app, 'coord@fonte.com', 'coord123');
  });

  afterAll(async () => {
    for (const id of createdGroupIds) {
      await request(app.getHttpServer()).delete(`${BASE}/support-groups/${id}`).set('Authorization', `Bearer ${token}`);
    }
    await app.close();
  });

  describe('authentication', () => {
    it('GET /support-groups → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/support-groups`).expect(401));
  });

  describe('validation', () => {
    it('POST /support-groups → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/support-groups`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400));

    it('POST /support-groups → 400 when dayOfWeek is out of range', () =>
      request(app.getHttpServer())
        .post(`${BASE}/support-groups`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'G', churchName: 'I', address: 'A', dayOfWeek: 9 })
        .expect(400));
  });

  describe('groups + meetings + checkins', () => {
    let groupId: string;
    let meetingId: string;
    let residentId: string;

    it('lists the seeded group', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/support-groups`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('creates a group', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/support-groups`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Grupo E2E ${Date.now()}`, churchName: 'Igreja E2E', address: 'Rua E2E', dayOfWeek: 6 })
        .expect(201);
      groupId = res.body.id;
      createdGroupIds.push(groupId);
    });

    it('creates a meeting for the group', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/support-groups/${groupId}/meetings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-06-07', notes: 'Primeira reunião' })
        .expect(201);
      meetingId = res.body.id;
      expect(meetingId).toBeDefined();
    });

    it('checks a family into the meeting and rejects a duplicate', async () => {
      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      residentId = residents.body.data[0].id;

      await request(app.getHttpServer())
        .post(`${BASE}/support-groups/meetings/${meetingId}/checkins`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentId })
        .expect(201);

      // Same family twice → 409
      await request(app.getHttpServer())
        .post(`${BASE}/support-groups/meetings/${meetingId}/checkins`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentId })
        .expect(409);
    });

    it('lists meeting checkins in the detail view', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/support-groups/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.checkins.length).toBeGreaterThanOrEqual(1);
    });
  });
});
