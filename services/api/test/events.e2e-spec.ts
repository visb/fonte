import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { StorageService } from '../src/modules/storage/storage.service';

// Storage mockado: nenhum bucket real é tocado e o upload devolve uma URL
// determinística. isS3Mode()=false faz o StorageUrlInterceptor repassar a URL.
const storageMock = {
  isS3Mode: () => false,
  isS3Url: () => false,
  signUrl: async (u: string) => u,
  decodeOriginalName: (n: string) => n,
  uniqueFilename: (n: string, prefix = '') => `${prefix}${n}`,
  upload: jest.fn(async () => 'https://bucket/events/banner_test.png'),
  delete: jest.fn(async () => undefined),
  onModuleInit: async () => undefined,
};

describe('EventController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let relativeToken: string;

  beforeAll(async () => {
    app = await bootstrapApp({
      overrideProvider: { token: StorageService, useValue: storageMock },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken } = await loginCoordinator(app));
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    relativeToken = await login(app, 'familiar@fonte.com', 'familiar123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM events');
    await app.close();
  });

  const validBody = () => ({
    title: 'Retiro de famílias',
    description: 'Encontro anual da comunidade',
    startAt: '2026-08-01T18:00:00.000Z',
    location: 'Sede',
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authorization', () => {
    it('POST /events → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/events`).send(validBody()).expect(401));

    it('GET /events → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/events`).expect(401));

    it('POST /events → 201 for COORDINATOR (authorized)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(validBody())
        .expect(201));

    it('POST /events → 403 for SERVANT (operator)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send(validBody())
        .expect(403));

    it('GET /events → 403 for RELATIVE (familiar)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/events`)
        .set('Authorization', `Bearer ${relativeToken}`)
        .expect(403));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('400 when startAt is not a date string', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), startAt: 'not-a-date' })
        .expect(400));

    it('400 when capacity is below 1', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), capacity: 0 })
        .expect(400));

    it('400 when endAt precedes startAt', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), endAt: '2026-07-01T18:00:00.000Z' })
        .expect(400));

    it('400 when registrationClosesAt precedes registrationOpensAt', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validBody(),
          registrationOpensAt: '2026-07-20T00:00:00.000Z',
          registrationClosesAt: '2026-07-10T00:00:00.000Z',
        })
        .expect(400));
  });

  // ── CRUD + banner ──────────────────────────────────────────────────────────────

  describe('CRUD flow', () => {
    let createdId: string;

    it('creates an event (admin) with the given fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), capacity: 100 })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Retiro de famílias');
      expect(res.body.capacity).toBe(100);
      expect(res.body.bannerUrl).toBeNull();
      createdId = res.body.id;
    });

    it('lists events ordered by start_at ascending', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody(), title: 'Evento anterior', startAt: '2026-07-15T18:00:00.000Z' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const dates = res.body.map((e: { startAt: string }) => e.startAt);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });

    it('filters upcoming vs past', async () => {
      const upcoming = await request(app.getHttpServer())
        .get(`${BASE}/events?filter=upcoming`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        upcoming.body.every((e: { startAt: string }) => new Date(e.startAt) >= new Date()),
      ).toBe(true);

      const past = await request(app.getHttpServer())
        .get(`${BASE}/events?filter=past`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(past.body.every((e: { startAt: string }) => new Date(e.startAt) < new Date())).toBe(
        true,
      );
    });

    it('gets one event by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/events/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.id).toBe(createdId);
    });

    it('404 for unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/events/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));

    it('updates an event (partial)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/events/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ location: 'Anexo', capacity: 50 })
        .expect(200);
      expect(res.body.location).toBe('Anexo');
      expect(res.body.capacity).toBe(50);
    });

    it('uploads a banner and returns the event with a banner url', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/events/${createdId}/banner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('fake-image'), {
          filename: 'banner.png',
          contentType: 'image/png',
        })
        .expect(201);
      expect(res.body.bannerUrl).toBe('https://bucket/events/banner_test.png');
    });

    it('rejects a non-image banner (400)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/events/${createdId}/banner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        })
        .expect(400));

    it('soft deletes an event (then 404 on get)', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/events/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`${BASE}/events/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
