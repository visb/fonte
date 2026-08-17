import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { FamilyInvestment, MovementType } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

/**
 * Story 182 — a limpeza desta suíte é POR ID DA FIXTURE, nunca por categoria.
 *
 * A versão anterior fazia `DELETE FROM inventory_items WHERE kind = 'STOREROOM'`.
 * Filtrar por `kind` limpa por *categoria*, não por *autoria*: levava junto o
 * "Arroz (kg)" que o `seed-test.ts` insere, derrubando o teste de catálogo do
 * `adm.fonte` no run seguinte. Pior: se uma contribuição em produtos já
 * apontasse para o item, o `ON DELETE SET NULL` da FK zerava
 * `inventory_item_id` e o `CHK_rpc_item_xor_description` estourava — o próprio
 * `DELETE` falhava e levava a suíte com ele.
 *
 * Regra: ninguém apaga linha que não criou. Todo item criado aqui entra em
 * `createdItemIds` e só esses ids são removidos, na ordem contribuições →
 * movimentos → itens. A catraca `e2e-cleanup-scope.spec.ts` impede a volta do
 * padrão antigo.
 */
describe('StoreroomController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let adminToken: string;
  let houseId: string;
  let staffId: string;

  /** Ids de tudo que ESTA suíte criou — a limpeza é escopada por eles. */
  const createdItemIds: string[] = [];
  /** Filho criado para o caso de contribuição em produtos (removido no fim). */
  let contributionResidentId: string | null = null;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);

    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    houseId = me.body.houseId;
    staffId = me.body.id;
  });

  /**
   * Remove só o que a fixture criou. Idempotente de propósito: o último teste a
   * chama para provar que o item do seed sobrevive e o `afterAll` a chama de
   * novo.
   */
  async function cleanupFixtureItems(): Promise<void> {
    if (!createdItemIds.length) return;
    // A contribuição sai ANTES do item: apagar o item primeiro zeraria
    // `inventory_item_id` (FK ON DELETE SET NULL) e violaria o XOR com
    // `description`.
    await dataSource.query(
      `DELETE FROM receivable_product_contributions WHERE inventory_item_id = ANY($1)`,
      [createdItemIds],
    );
    await dataSource.query(`DELETE FROM inventory_movements WHERE item_id = ANY($1)`, [createdItemIds]);
    await dataSource.query(`DELETE FROM inventory_items WHERE id = ANY($1)`, [createdItemIds]);
  }

  afterAll(async () => {
    await cleanupFixtureItems();
    if (contributionResidentId) {
      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${contributionResidentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  // Nome único: dois runs sem reseed (ou um run interrompido) não colidem nas
  // asserções de listagem, e nenhum deles se confunde com o "Arroz" do seed.
  const itemBody = () => ({ name: `Arroz Storeroom ${Date.now()}`, unit: 'kg', houseId });

  /** Cria um item registrando o id para a limpeza da fixture. */
  async function createItem(body: { name: string; unit: string; houseId: string }) {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/storerooms/items`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send(body)
      .expect(201);
    createdItemIds.push(res.body.id);
    return res.body;
  }

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
          date: '2026-05-17',
        })
        .expect(400));
  });

  // ── Items CRUD + stock movement flow ──────────────────────────────────────────

  describe('items CRUD and movements', () => {
    let itemId: string;
    let itemName: string;

    it('creates an item with zero starting quantity', async () => {
      const body = itemBody();
      const item = await createItem(body);

      expect(item.id).toBeDefined();
      expect(item.name).toBe(body.name);
      expect(item.unit).toBe('kg');
      expect(item.houseId).toBe(houseId);
      expect(Number(item.currentQuantity)).toBe(0);
      itemId = item.id;
      itemName = item.name;
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
      const renamed = `${itemName} Integral`;
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/storerooms/items/${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: renamed })
        .expect(200);

      expect(res.body.name).toBe(renamed);
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

  // ── Limpeza da fixture (story 182) ──────────────────────────────────────────

  describe('fixture cleanup scope', () => {
    it('limpa item referenciado por contribuição de catálogo sem violar o XOR', async () => {
      // Reproduz de propósito o cenário que derrubava a suíte: uma contribuição
      // em produtos apontando para o item da fixture.
      const today = new Date().toISOString().slice(0, 10);
      const resident = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          name: `Contribuinte Storeroom ${Date.now()}`,
          houseId,
          entryDate: today,
          familyInvestment: FamilyInvestment.PAYMENT_700,
          contributionDueDay: 10,
        })
        .expect(201);
      contributionResidentId = resident.body.id;

      const item = await createItem(itemBody());

      const receivables = await request(app.getHttpServer())
        .get(`${BASE}/residents/${contributionResidentId}/receivables`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const receivableId = receivables.body[0].id;

      await request(app.getHttpServer())
        .post(`${BASE}/residents/${contributionResidentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [{ inventoryItemId: item.id, quantity: 3, unit: 'kg' }] })
        .expect(201);

      // A limpeza da fixture roda sem estourar o CHK_rpc_item_xor_description.
      await expect(cleanupFixtureItems()).resolves.toBeUndefined();

      const rows = await dataSource.query(
        `SELECT count(*)::int AS count FROM inventory_items WHERE id = $1`,
        [item.id],
      );
      expect(rows[0].count).toBe(0);
    });

    it('preserva o item "Arroz" do seed — a limpeza é por id, não por kind', async () => {
      const rows = await dataSource.query(
        `SELECT count(*)::int AS count FROM inventory_items WHERE name = 'Arroz' AND deleted_at IS NULL`,
      );
      expect(rows[0].count).toBeGreaterThanOrEqual(1);
    });
  });
});
