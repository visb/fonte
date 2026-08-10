import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  IncidentSeverity,
  MovementType,
  StreetSaleType,
  SupplyRoomCategory,
} from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

const HEADER = 'Idempotency-Key';
const today = () => new Date().toISOString().split('T')[0];

/**
 * Story 172 — o reenvio da outbox do ops (epic 167/169) não pode duplicar
 * lançamento. Cada família do escopo tem um caso; o almoxarifado, que não tem
 * estorno, tem o caso completo (contagem, estoque e resposta memorizada).
 */
describe('Idempotency (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let adminToken: string;
  let houseId: string;
  let staffId: string;
  let itemId: string;

  const auth = (token = coordToken) => ({ Authorization: `Bearer ${token}` });

  const movementBody = (quantity = 5, type: MovementType = MovementType.IN) => ({
    itemId,
    type,
    quantity,
    responsibleId: staffId,
    date: today(),
  });

  const currentQuantity = async (): Promise<number> => {
    const [row] = await dataSource.query(
      `SELECT current_quantity FROM inventory_items WHERE id = $1`,
      [itemId],
    );
    return Number(row.current_quantity);
  };

  const movementCount = async (): Promise<number> => {
    const [row] = await dataSource.query(
      `SELECT count(*)::int AS total FROM inventory_movements WHERE item_id = $1`,
      [itemId],
    );
    return row.total;
  };

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set(auth())
      .expect(200);
    staffId = me.body.id;

    const item = await request(app.getHttpServer())
      .post(`${BASE}/storerooms/items`)
      .set(auth())
      .send({ name: 'Feijão idempotente', unit: 'kg', houseId })
      .expect(201);
    itemId = item.body.id;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM inventory_movements WHERE item_id = $1`, [itemId]);
    await dataSource.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
    await dataSource.query(`DELETE FROM activity_events`);
    await dataSource.query(`DELETE FROM activities`);
    await dataSource.query(`DELETE FROM incidents`);
    await dataSource.query(`DELETE FROM street_sales`);
    await dataSource.query(`DELETE FROM idempotency_keys`);
    await app.close();
  });

  // ── almoxarifado: o caso que motiva a story ─────────────────────────────────

  describe('POST /storerooms/movements', () => {
    it('a mesma Idempotency-Key cria um único movimento e devolve a resposta original', async () => {
      const key = randomUUID();
      const before = await currentQuantity();

      const first = await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(movementBody(10))
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(movementBody(10))
        .expect(201);

      expect(second.body).toEqual(first.body);
      expect(await movementCount()).toBe(1);
      expect(await currentQuantity()).toBe(before + 10);
    });

    it('chaves diferentes criam dois movimentos (não deduplica demais)', async () => {
      const before = await currentQuantity();

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, randomUUID())
        .send(movementBody(3))
        .expect(201);

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, randomUUID())
        .send(movementBody(3))
        .expect(201);

      expect(await currentQuantity()).toBe(before + 6);
    });

    it('sem header preserva o comportamento de hoje (duas requisições, dois movimentos)', async () => {
      const before = await currentQuantity();

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .send(movementBody(2))
        .expect(201);

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .send(movementBody(2))
        .expect(201);

      expect(await currentQuantity()).toBe(before + 4);
    });

    it('header que não é UUID → 400 e nada é gravado', async () => {
      const before = await currentQuantity();

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, 'chave-qualquer')
        .send(movementBody(1))
        .expect(400);

      expect(await currentQuantity()).toBe(before);
    });

    it('handler que falha libera a reserva: o reenvio corrigido com a mesma chave executa', async () => {
      const key = randomUUID();
      const before = await currentQuantity();

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(movementBody(99999, MovementType.OUT))
        .expect(400);

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(movementBody(4))
        .expect(201);

      expect(await currentQuantity()).toBe(before + 4);
    });

    it('a mesma chave de outro usuário executa normalmente (isolamento por usuário)', async () => {
      const key = randomUUID();
      const before = await currentQuantity();

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(movementBody(1))
        .expect(201);

      await request(app.getHttpServer())
        .post(`${BASE}/storerooms/movements`)
        .set(auth(adminToken))
        .set(HEADER, key)
        .send(movementBody(1))
        .expect(201);

      expect(await currentQuantity()).toBe(before + 2);
    });
  });

  // ── despensa ───────────────────────────────────────────────────────────────

  describe('POST /supply-room/movements', () => {
    it('duplicata não cria segundo movimento', async () => {
      const item = await request(app.getHttpServer())
        .post(`${BASE}/supply-room/items`)
        .set(auth())
        .set(HEADER, randomUUID())
        .send({
          name: 'Sabão idempotente',
          unit: 'un',
          category: SupplyRoomCategory.CLEANING,
          houseId,
        })
        .expect(201);

      const key = randomUUID();
      const body = {
        itemId: item.body.id,
        type: MovementType.IN,
        quantity: 7,
        responsibleId: staffId,
        date: today(),
      };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/supply-room/movements`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const [row] = await dataSource.query(
        `SELECT count(*)::int AS total FROM inventory_movements WHERE item_id = $1`,
        [item.body.id],
      );
      expect(row.total).toBe(1);

      await dataSource.query(`DELETE FROM inventory_movements WHERE item_id = $1`, [item.body.id]);
      await dataSource.query(`DELETE FROM inventory_items WHERE id = $1`, [item.body.id]);
    });
  });

  // ── ocorrência ─────────────────────────────────────────────────────────────

  describe('POST /incidents', () => {
    it('duplicata não cria segunda ocorrência', async () => {
      const key = randomUUID();
      const body = {
        date: today(),
        severity: IncidentSeverity.LOW,
        description: 'Ocorrência reenviada pela fila',
        houseId,
        responsibleId: staffId,
      };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const [row] = await dataSource.query(
        `SELECT count(*)::int AS total FROM incidents WHERE description = $1`,
        [body.description],
      );
      expect(row.total).toBe(1);
    });
  });

  // ── venda de rua ───────────────────────────────────────────────────────────

  describe('POST /street-sales', () => {
    it('duplicata não cria segunda venda', async () => {
      const key = randomUUID();
      const body = {
        houseId,
        date: today(),
        type: StreetSaleType.BREAD,
        quantity: 12,
        amountPix: 10,
        amountCash: 5,
        amountCard: 0,
      };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/street-sales`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const [row] = await dataSource.query(
        `SELECT count(*)::int AS total FROM street_sales WHERE house_id = $1`,
        [houseId],
      );
      expect(row.total).toBe(1);
    });
  });

  // ── atividade ──────────────────────────────────────────────────────────────

  describe('POST /activities', () => {
    it('duplicata não cria segunda atividade', async () => {
      const key = randomUUID();
      const body = { title: 'Consertar torneira (reenvio)', houseId };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const [row] = await dataSource.query(
        `SELECT count(*)::int AS total FROM activities WHERE title = $1`,
        [body.title],
      );
      expect(row.total).toBe(1);
    });
  });

  // ── censo ──────────────────────────────────────────────────────────────────

  describe('POST /census/residents', () => {
    it('duplicata não cria segundo filho na contagem', async () => {
      const key = randomUUID();
      const name = `Idempotente ${randomUUID().slice(0, 8)}`;
      const body = { name, houseId, entryDate: today() };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/census/residents`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`${BASE}/census/residents`)
        .set(auth())
        .set(HEADER, key)
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const [row] = await dataSource.query(
        `SELECT count(*)::int AS total FROM residents WHERE name = $1`,
        [name],
      );
      expect(row.total).toBe(1);
    });
  });
});
