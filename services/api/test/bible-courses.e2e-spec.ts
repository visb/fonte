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
  let houseId: string;
  const createdClassIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
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
});
