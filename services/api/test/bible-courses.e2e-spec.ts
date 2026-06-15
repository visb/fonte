import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BibleCourseEnrollmentStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('BibleCourseController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let adminToken: string;
  let houseId: string;
  const createdClassIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
  });

  afterAll(async () => {
    for (const id of createdClassIds) {
      await request(app.getHttpServer()).delete(`${BASE}/bible-course/classes/${id}`).set('Authorization', `Bearer ${token}`);
    }
    await app.close();
  });

  describe('authentication', () => {
    it('GET /bible-course/classes → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/bible-course/classes`).expect(401));
  });

  describe('validation', () => {
    it('POST /bible-course/classes → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400));
  });

  describe('classes + enrollments', () => {
    let classId: string;
    let residentId: string;

    it('creates a class', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Turma E2E ${Date.now()}`, houseId, startDate: '2026-06-01', endDate: '2026-09-01' })
        .expect(201);
      classId = res.body.id;
      createdClassIds.push(classId);
    });

    it('lists classes', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('enrolls a resident and rejects a duplicate', async () => {
      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      residentId = residents.body.data[0].id;

      const enrollment = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentId })
        .expect(201);
      expect(enrollment.body.id).toBeDefined();

      await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentId })
        .expect(409);
    });

    it('marks the class detail with the enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.enrollments.length).toBeGreaterThanOrEqual(1);

      // Complete the enrollment.
      const enrollmentId = res.body.enrollments[0].id;
      const updated = await request(app.getHttpServer())
        .patch(`${BASE}/bible-course/enrollments/${enrollmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BibleCourseEnrollmentStatus.COMPLETED })
        .expect(200);
      expect(updated.body.completedAt).not.toBeNull();
    });

    it('GET /bible-course/classes/:id → 404 for an unknown class', () =>
      request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));
  });

  describe('modules (catalogo, ADMIN only)', () => {
    let moduleId: string;

    it('GET /bible-course/modules → 403 for a non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403));

    it('POST /bible-course/modules → 403 for a non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Gênesis' })
        .expect(403));

    it('POST /bible-course/modules → 400 with empty body (ADMIN)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('ADMIN creates a module', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Gênesis ${Date.now()}`, sequence: 1, notes: 'Primeiro módulo' })
        .expect(201);
      moduleId = res.body.id;
      expect(res.body.sequence).toBe(1);
    });

    it('ADMIN lists modules ordered', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((m: { id: string }) => m.id === moduleId)).toBe(true);
    });

    it('ADMIN edits a module (reorder via sequence)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/bible-course/modules/${moduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sequence: 5, name: 'Êxodo' })
        .expect(200);
      expect(res.body.sequence).toBe(5);
      expect(res.body.name).toBe('Êxodo');
    });

    it('PATCH /bible-course/modules/:id → 404 for an unknown module (ADMIN)', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/bible-course/modules/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X' })
        .expect(404));

    it('DELETE /bible-course/modules/:id → 403 for a non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/bible-course/modules/${moduleId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403));

    it('ADMIN soft deletes a module', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/bible-course/modules/${moduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204));
  });
});
