import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { MovementType, SupplyRoomCategory } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('SupplyRoomController (e2e)', () => {
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
    // catálogo unificado — limpa apenas os itens de dispensa
    await dataSource.query(`DELETE FROM inventory_movements WHERE kind = 'SUPPLY_ROOM'`);
    await dataSource.query(`DELETE FROM inventory_items WHERE kind = 'SUPPLY_ROOM'`);
    await app.close();
  });

  const itemBody = () => ({
    name: 'Sabão em pó',
    unit: 'kg',
    category: SupplyRoomCategory.CLEANING,
    houseId,
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authentication', () => {
    it('GET /supply-room/items → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/supply-room/items`).expect(401));

    it('POST /supply-room/items → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/supply-room/items`).send(itemBody()).expect(401));

    it('GET /supply-room/movements → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/supply-room/movements`).expect(401));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('POST /supply-room/items → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({})
        .expect(400));

    it('POST /supply-room/items → 400 when category is invalid', () =>
      request(app.getHttpServer())
        .post(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ ...itemBody(), category: 'NOT_A_CATEGORY' })
        .expect(400));

    it('POST /supply-room/movements → 400 when quantity is not positive', () =>
      request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId: '00000000-0000-0000-0000-000000000000',
          type: MovementType.IN,
          quantity: 0,
          responsibleId: staffId,
          date: '2026-05-15',
        })
        .expect(400));
  });

  // ── Items CRUD + stock movement flow ──────────────────────────────────────────

  describe('items CRUD and movements', () => {
    let itemId: string;

    it('creates an item preserving the supply-room shape (category, no storeroom/kind fields)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send(itemBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Sabão em pó');
      expect(res.body.unit).toBe('kg');
      expect(res.body.category).toBe(SupplyRoomCategory.CLEANING);
      expect(res.body.houseId).toBe(houseId);
      expect(Number(res.body.currentQuantity)).toBe(0);
      // contrato de saída inalterado: o discriminador interno não vaza,
      // nem os campos exclusivos do almoxarifado.
      expect(res.body.kind).toBeUndefined();
      expect(res.body.weeklyAverageUsage).toBeUndefined();
      itemId = res.body.id;
    });

    it('lists items scoped by houseId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((i: { id: string }) => i.id === itemId)).toBe(true);
      expect(res.body.every((i: { houseId: string }) => i.houseId === houseId)).toBe(true);
      // não há vazamento de itens de almoxarifado nesta rota
      expect(res.body.every((i: { kind?: string }) => i.kind === undefined)).toBe(true);
    });

    it('updates the item category', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/supply-room/items/${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ category: SupplyRoomCategory.HYGIENE })
        .expect(200);

      expect(res.body.category).toBe(SupplyRoomCategory.HYGIENE);
    });

    it('404 when updating an unknown item', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/supply-room/items/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: 'X' })
        .expect(404));

    it('registers an IN movement and increases the stock', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId,
          type: MovementType.IN,
          quantity: 12,
          responsibleId: staffId,
          date: '2026-05-15',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      const item = res.body.find((i: { id: string }) => i.id === itemId);
      expect(Number(item.currentQuantity)).toBe(12);
    });

    it('registers an OUT movement and decreases the stock', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId,
          type: MovementType.OUT,
          quantity: 5,
          responsibleId: staffId,
          date: '2026-05-16',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      const item = res.body.find((i: { id: string }) => i.id === itemId);
      expect(Number(item.currentQuantity)).toBe(7);
    });

    it('rejects an OUT movement exceeding the current stock (400)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
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
        .post(`${BASE}/supply-room/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          itemId: '00000000-0000-0000-0000-000000000000',
          type: MovementType.IN,
          quantity: 1,
          responsibleId: staffId,
          date: '2026-05-17',
        })
        .expect(404));

    it('lists movements filtered by itemId (no storeroom leakage)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/supply-room/movements`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ itemId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.every((m: { itemId?: string; item?: { id: string } }) => (m.item?.id ?? m.itemId) === itemId)).toBe(true);
    });

    it('soft-deletes the item (then absent from the list)', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/supply-room/items/${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/supply-room/items`)
        .set('Authorization', `Bearer ${coordToken}`)
        .query({ houseId })
        .expect(200);

      expect(res.body.some((i: { id: string }) => i.id === itemId)).toBe(false);
    });
  });
});
