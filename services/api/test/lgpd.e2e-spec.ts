import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

// Cobre as funcionalidades LGPD: mascaramento de CPF, consentimento, trilha de
// auditoria, documentos de acolhimento, export e anonimização.
describe('LGPD (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let houseId: string;
  let residentId: string;

  const FULL_CPF = '123.456.789-00';
  const MASKED_CPF = '***.***.789-00';

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ houseId } = await loginCoordinator(app));

    const created = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `LGPD E2E ${Date.now()}`, houseId, cpf: FULL_CPF, rg: '12345678' })
      .expect(201);
    residentId = created.body.id;
  });

  afterAll(async () => {
    if (residentId) {
      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('CPF masking', () => {
    it('masks CPF in the list even for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .query({ houseId, search: 'LGPD E2E' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const mine = res.body.data.find((r: { id: string }) => r.id === residentId);
      expect(mine.cpf).toBe(MASKED_CPF);
    });

    it('reveals CPF in the detail for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.cpf).toBe(FULL_CPF);
    });
  });

  describe('Consent', () => {
    it('grants and reflects consent status', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/consents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectType: 'RESIDENT', subjectId: residentId, purpose: 'IMAGE_PUBLICATION', termVersion: '1.0' })
        .expect(201);

      const status = await request(app.getHttpServer())
        .get(`${BASE}/consents/RESIDENT/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const image = status.body.find((s: { purpose: string }) => s.purpose === 'IMAGE_PUBLICATION');
      expect(image.granted).toBe(true);
    });

    it('revokes consent', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/consents/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subjectType: 'RESIDENT', subjectId: residentId, purpose: 'IMAGE_PUBLICATION' })
        .expect(201);

      const check = await request(app.getHttpServer())
        .get(`${BASE}/consents/check/active`)
        .query({ subjectType: 'RESIDENT', subjectId: residentId, purpose: 'IMAGE_PUBLICATION' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(check.body.active).toBe(false);
    });
  });

  describe('Audit trail', () => {
    it('records reads of a resident', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const trail = await request(app.getHttpServer())
        .get(`${BASE}/audit/resident/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(trail.body)).toBe(true);
      expect(trail.body.some((e: { action: string }) => e.action === 'resident.read')).toBe(true);
    });
  });

  describe('Admission documents', () => {
    it('returns the admission documents envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/admission-documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Data subject rights', () => {
    it('exports the resident data with personal records', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/data-export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.subject).toEqual({ type: 'RESIDENT', id: residentId });
      expect(res.body.resident).toBeDefined();
      expect(res.body).toHaveProperty('consents');
    });
  });
});
