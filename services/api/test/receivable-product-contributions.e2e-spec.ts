import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { FamilyInvestment } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 112 — contribuição em produtos na declaração da parcela.
 * Cobre: declarar (catálogo + avulso), listar via GET da parcela, reflexo no
 * estoque, guarda de role (SERVANT declara produtos; valor segue restrito) e
 * remoção como correção sem estorno.
 */
describe('Receivable product contributions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let servantToken: string;
  let adminToken: string;
  let houseId: string;
  let residentId: string;
  let itemId: string;
  let receivableId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const today = new Date().toISOString().slice(0, 10);
    const resident = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({
        name: `Contribuinte Produtos ${Date.now()}`,
        houseId,
        entryDate: today,
        familyInvestment: FamilyInvestment.PAYMENT_700,
        contributionDueDay: 10,
      })
      .expect(201);
    residentId = resident.body.id;

    // Catálogo unificado: um item de almoxarifado para o modo catálogo.
    const item = await request(app.getHttpServer())
      .post(`${BASE}/storerooms/items`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ name: `Arroz Contrib ${Date.now()}`, unit: 'kg', houseId })
      .expect(201);
    itemId = item.body.id;

    const list = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/receivables`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    receivableId = list.body[0].id;
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM receivable_product_contributions WHERE receivable_id IN (SELECT id FROM resident_receivables WHERE resident_id = $1)`,
      [residentId],
    );
    await dataSource.query(`DELETE FROM inventory_movements WHERE item_id = $1`, [itemId]);
    await dataSource.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
    await request(app.getHttpServer())
      .delete(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    await app.close();
  });

  describe('authentication & authorization', () => {
    it('POST product-contributions → 401 without token', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .send({ lines: [{ description: 'x' }] })
        .expect(401));

    it('SERVANT can declare products (liberado para ops)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send({ lines: [{ description: 'cesta básica servo' }] })
        .expect(201);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].pendingDetailing).toBe(true);
    });

    it('SERVANT still cannot register a money payment (valor segue restrito)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/payment`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send({ paidAt: new Date().toISOString().slice(0, 10), paymentMethod: 'PIX' })
        .expect(403));
  });

  describe('declare + list', () => {
    it('catalog mode raises stock and links the IN movement', async () => {
      const before = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items?houseId=${houseId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const beforeQty = Number(before.body.find((i: { id: string }) => i.id === itemId).currentQuantity);

      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          lines: [
            { inventoryItemId: itemId, quantity: 12, unit: 'kg' },
            { description: 'roupas doadas' },
          ],
        })
        .expect(201);

      expect(res.body).toHaveLength(2);
      const catalog = res.body.find((l: { inventoryItemId: string | null }) => l.inventoryItemId === itemId);
      expect(catalog.inventoryMovementId).toBeTruthy();
      expect(catalog.pendingDetailing).toBe(false);
      expect(Number(catalog.quantity)).toBe(12);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items?houseId=${houseId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const afterQty = Number(after.body.find((i: { id: string }) => i.id === itemId).currentQuantity);
      expect(afterQty).toBe(beforeQty + 12);

      // Movimento IN vinculado existe no histórico do item.
      const movements = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/movements?itemId=${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const linked = movements.body.find((m: { id: string }) => m.id === catalog.inventoryMovementId);
      expect(linked).toBeDefined();
      expect(linked.type).toBe('IN');
    });

    it('GET product-contributions lists the parcela contributions', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(200);
      // cesta básica + arroz catálogo + roupas doadas
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('GET receivables includes productContributions on the parcela', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const parcela = res.body.find((r: { id: string }) => r.id === receivableId);
      expect(Array.isArray(parcela.productContributions)).toBe(true);
      expect(parcela.productContributions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('validation', () => {
    it('400 when a line has both item and description', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [{ inventoryItemId: itemId, description: 'x', quantity: 1 }] })
        .expect(400));

    it('400 when a line has neither item nor description', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [{ quantity: 1 }] })
        .expect(400));

    it('400 when catalog quantity is not positive', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [{ inventoryItemId: itemId, quantity: 0 }] })
        .expect(400));

    it('400 with an empty lines array', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [] })
        .expect(400));
  });

  describe('removal = correction without reversal', () => {
    it('removing a catalog line creates an OUT correction and keeps the IN', async () => {
      const declared = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ lines: [{ inventoryItemId: itemId, quantity: 4, unit: 'kg' }] })
        .expect(201);
      const contributionId = declared.body[0].id;
      const inMovementId = declared.body[0].inventoryMovementId;

      const before = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items?houseId=${houseId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const beforeQty = Number(before.body.find((i: { id: string }) => i.id === itemId).currentQuantity);

      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions/${contributionId}`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/items?houseId=${houseId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const afterQty = Number(after.body.find((i: { id: string }) => i.id === itemId).currentQuantity);
      expect(afterQty).toBe(beforeQty - 4);

      const movements = await request(app.getHttpServer())
        .get(`${BASE}/storerooms/movements?itemId=${itemId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      // IN original preservado (sem estorno) + OUT de correção presente.
      expect(movements.body.some((m: { id: string }) => m.id === inMovementId)).toBe(true);
      expect(movements.body.some((m: { type: string; quantity: string }) => m.type === 'OUT' && Number(m.quantity) === 4)).toBe(true);

      // A linha não aparece mais na listagem da parcela.
      const list = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(list.body.some((l: { id: string }) => l.id === contributionId)).toBe(false);
    });
  });
});
