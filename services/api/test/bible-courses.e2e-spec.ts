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
  let servantToken: string;
  let houseId: string;
  const createdClassIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
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

  describe('eligible residents + bulk enrollment (story 99)', () => {
    let eligibleId: string;
    let freshId: string;
    let classId: string;

    beforeAll(async () => {
      // Interno elegível: casa suficiente (bem antigo) e ativo.
      const eligible = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Elegível ${Date.now()}`, houseId, status: 'ACTIVE', entryDate: '2020-01-01' })
        .expect(201);
      eligibleId = eligible.body.id;

      // Interno recém-entrado: não deve aparecer (menos de 3 meses).
      const today = new Date().toISOString().split('T')[0];
      const fresh = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Recente ${Date.now()}`, houseId, status: 'ACTIVE', entryDate: today })
        .expect(201);
      freshId = fresh.body.id;
    });

    it('GET /classes/eligible-residents → 403 for a role without permission (servant)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/eligible-residents`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('lists the eligible resident and excludes the freshly-entered one', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/eligible-residents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const eligible = res.body.find((r: { id: string }) => r.id === eligibleId);
      expect(eligible).toBeDefined();
      expect(eligible.monthsInTreatment).toBeGreaterThanOrEqual(3);
      expect(eligible.houseId).toBe(houseId);
      expect(res.body.some((r: { id: string }) => r.id === freshId)).toBe(false);
    });

    it('POST /classes/:id/enrollments/bulk creates the enrollments atomically', async () => {
      const klass = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Turma Bulk ${Date.now()}`, houseId, startDate: '2026-06-01', endDate: '2026-09-01' })
        .expect(201);
      classId = klass.body.id;
      createdClassIds.push(classId);

      // Ids duplicados são deduplicados → 1 matrícula.
      const res = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentIds: [eligibleId, eligibleId] })
        .expect(201);
      expect(res.body.enrolled).toBe(1);

      const detail = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.enrollments.some((e: { residentId: string }) => e.residentId === eligibleId)).toBe(true);
    });

    it('once enrolled, the resident drops off the eligible list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/eligible-residents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.some((r: { id: string }) => r.id === eligibleId)).toBe(false);
    });

    it('re-running the bulk on already-enrolled residents enrolls none', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentIds: [eligibleId] })
        .expect(201);
      expect(res.body.enrolled).toBe(0);
    });

    it('POST bulk → 400 with an empty residentIds array', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentIds: [] })
        .expect(400));

    it('POST bulk → 404 for an unknown resident (rolls back)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments/bulk`)
        .set('Authorization', `Bearer ${token}`)
        .send({ residentIds: ['11111111-1111-4111-8111-111111111111'] })
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

  describe('grades (notas por módulo, ADMIN only)', () => {
    let classId: string;
    let enrollmentId: string;
    let moduleId: string;

    beforeAll(async () => {
      // Turma própria para as notas.
      const klass = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Turma Notas ${Date.now()}`, houseId, startDate: '2026-06-01', endDate: '2026-09-01' })
        .expect(201);
      classId = klass.body.id;
      createdClassIds.push(classId);

      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const residentId = residents.body.data[0].id;

      const enrollment = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ residentId })
        .expect(201);
      enrollmentId = enrollment.body.id;

      const module = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/modules`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Módulo Notas ${Date.now()}`, sequence: 1 })
        .expect(201);
      moduleId = module.body.id;
    });

    it('GET grades → 403 for a non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}/grades`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403));

    it('PUT grade → 403 for a non-ADMIN (coordinator)', () =>
      request(app.getHttpServer())
        .put(`${BASE}/bible-course/enrollments/${enrollmentId}/grades/${moduleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ examGrade: 8 })
        .expect(403));

    it('PUT grade → 400 when the grade is out of 0–10', () =>
      request(app.getHttpServer())
        .put(`${BASE}/bible-course/enrollments/${enrollmentId}/grades/${moduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ examGrade: 11 })
        .expect(400));

    it('ADMIN launches an exam grade (creates the row)', async () => {
      const res = await request(app.getHttpServer())
        .put(`${BASE}/bible-course/enrollments/${enrollmentId}/grades/${moduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ examGrade: 8 })
        .expect(200);
      expect(Number(res.body.examGrade)).toBe(8);
    });

    it('ADMIN edits the same grade row without duplicating + adds the work grade', async () => {
      const res = await request(app.getHttpServer())
        .put(`${BASE}/bible-course/enrollments/${enrollmentId}/grades/${moduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ examGrade: 10, workGrade: 8 })
        .expect(200);
      expect(Number(res.body.examGrade)).toBe(10);
      expect(Number(res.body.workGrade)).toBe(8);
    });

    it('ADMIN reads the matrix with computed averages', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}/grades`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.classId).toBe(classId);
      expect(res.body.modules.some((m: { id: string }) => m.id === moduleId)).toBe(true);

      const row = res.body.rows.find((r: { enrollmentId: string }) => r.enrollmentId === enrollmentId);
      expect(row).toBeDefined();
      const cell = row.modules.find((m: { moduleId: string }) => m.moduleId === moduleId);
      expect(cell.examGrade).toBe(10);
      expect(cell.workGrade).toBe(8);
      // média do módulo = (10 + 8) / 2 = 9
      expect(cell.moduleAverage).toBe(9);
      // média do aluno (só este módulo com nota) = 9
      expect(row.average).toBe(9);
    });
  });

  describe('class photos (galeria por turma, story 92)', () => {
    let classId: string;

    beforeAll(async () => {
      const klass = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Turma Fotos ${Date.now()}`, houseId, startDate: '2026-06-01', endDate: '2026-09-01' })
        .expect(201);
      classId = klass.body.id;
      createdClassIds.push(classId);
    });

    it('GET photos → 401 without token', () =>
      request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}/photos`)
        .expect(401));

    it('POST photo → 401 without token', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/photos`)
        .attach('file', Buffer.from('fake-jpeg'), { filename: 'turma.jpg', contentType: 'image/jpeg' })
        .expect(401));

    it('POST photo → 400 rejects a non-image mimetype', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' })
        .expect(400));

    it('POST photo → 404 for an unknown class', () =>
      request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/00000000-0000-0000-0000-000000000000/photos`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-jpeg'), { filename: 'turma.jpg', contentType: 'image/jpeg' })
        .expect(404));

    it('uploads → lists → deletes a photo (authenticated)', async () => {
      const upload = await request(app.getHttpServer())
        .post(`${BASE}/bible-course/classes/${classId}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-jpeg'), { filename: 'turma.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(upload.body.id).toBeDefined();
      expect(upload.body.classId).toBe(classId);
      expect(upload.body.mimeType).toBe('image/jpeg');
      const photoId = upload.body.id;

      const list = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.some((p: { id: string }) => p.id === photoId)).toBe(true);

      await request(app.getHttpServer())
        .delete(`${BASE}/bible-course/classes/${classId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/bible-course/classes/${classId}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(after.body.some((p: { id: string }) => p.id === photoId)).toBe(false);
    });

    it('DELETE photo → 404 for an unknown photo', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/bible-course/classes/${classId}/photos/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));
  });
});
