import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { MovementType } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('StoreroomController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let houseId: string;
  let staffId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);

    coordToken = await login(app, 'coord@fonte.com', 'coord123');

    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    houseId = me.body.houseId;
    staffId = me.body.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM storeroom_movements');
    await dataSource.query('DELETE FROM storeroom_items');
    await app.close();
  });

  const itemBody = () => ({ name: 'Arroz', unit: 'kg', houseId });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authentication', () => {
    it('GET /storerooms/items → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/storerooms/items`).expect(401));

    it('POST /storerooms/items → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/storerooms/items`).send(itemBody()).expect(401));

    it('GET /storerooms/movements → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/storerooms/movements`).expect(401));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('POST /storerooms/items → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({})
        .expect(400));

    it('POST /storerooms/items → 400 when houseId is not a UUID', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ ...itemBody(), houseId: 'not-a-uuid' })
        .expect(400));

    it('POST /storerooms/movements → 400 when quantity is not positive', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId: '00000000-0000-0000-0000-000000000000',
          type: MovementType.IN,
          quantity: 0,
          responsibleId: staffId,
          date: '2026-05-15',
        })
        .expect(400));

    it('POST /storerooms/movements → 400 when type is invalid', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId: '00000000-0000-0000-0000-000000000000',
          type: 'INVALID',
          quantity: 5,
          responsibleId: staffId,
          date: '2026-05-15',
        })
        .expect(400));
  });

  // ── Items CRUD + stock movement flow ──────────────────────────────────────────

  describe('items CRUD and movements', () => {
    let itemId: string;

    it('creates an item with zero starting quantity', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(itemBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Arroz');
      expect(res.body.unit).toBe('kg');
      expect(res.body.houseId).toBe(houseId);
      expect(Number(res.body.currentQuantity)).toBe(0);
      itemId = res.body.id;
    });

    it('lists items scoped by houseId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((i: { id: string }) => i.id === itemId)).toBe(true);
      expect(res.body.every((i: { houseId: string }) => i.houseId === houseId)).toBe(true);
    });

    it('updates the item name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/storerooms/items/${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: 'Arroz Integral' })
        .expect(200);

      expect(res.body.name).toBe('Arroz Integral');
    });

    it('404 when updating an unknown item', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/storerooms/items/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: 'X' })
        .expect(404));

    it('registers an IN movement and increases the stock', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId,
          type: MovementType.IN,
          quantity: 10,
          responsibleId: staffId,
          date: '2026-05-15',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      const item = res.body.find((i: { id: string }) => i.id === itemId);
      expect(Number(item.currentQuantity)).toBe(10);
    });

    it('registers an OUT movement and decreases the stock', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId,
          type: MovementType.OUT,
          quantity: 4,
          responsibleId: staffId,
          date: '2026-05-16',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      const item = res.body.find((i: { id: string }) => i.id === itemId);
      expect(Number(item.currentQuantity)).toBe(6);
    });

    it('rejects an OUT movement exceeding the current stock (400)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId,
          type: MovementType.OUT,
          quantity: 999,
          responsibleId: staffId,
          date: '2026-05-17',
        })
        .expect(400));

    it('404 when moving an unknown item', () =>
      request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId: '00000000-0000-0000-0000-000000000000',
          type: MovementType.IN,
          quantity: 1,
          responsibleId: staffId,
          date: '2026-05-17',
        })
        .expect(404));

    it('lists movements filtered by itemId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ itemId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.every((m: { itemId?: string; item?: { id: string } }) => (m.item?.id ?? m.itemId) === itemId)).toBe(true);
    });

    it('soft-deletes the item (then absent from the list)', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/storerooms/items/${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === itemId)).toBe(false);
    });
  });
});
