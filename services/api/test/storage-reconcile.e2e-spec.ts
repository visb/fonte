import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

// Story 93 — endpoint ADMIN one-shot de reconciliação de órfãos no bucket.
// Dry-run por padrão; restrito a ADMIN.
describe('StorageController reconcile (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /storage/reconcile → 401 sem token', () =>
    request(app.getHttpServer()).post(`${BASE}/storage/reconcile`).expect(401));

  it('POST /storage/reconcile → 403 para não-ADMIN (COORDINATOR)', () =>
    request(app.getHttpServer())
      .post(`${BASE}/storage/reconcile`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));

  it('POST /storage/reconcile → 200 dry-run por padrão (apply=false, nada apagado)', () =>
    request(app.getHttpServer())
      .post(`${BASE}/storage/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.apply).toBe(false);
        expect(res.body.deletedCount).toBe(0);
        expect(Array.isArray(res.body.orphanKeys)).toBe(true);
        expect(typeof res.body.bucketObjects).toBe('number');
        expect(typeof res.body.referencedObjects).toBe('number');
      }));

  it('POST /storage/reconcile?apply=true → 200 para ADMIN', () =>
    request(app.getHttpServer())
      .post(`${BASE}/storage/reconcile?apply=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.apply).toBe(true);
      }));
});
