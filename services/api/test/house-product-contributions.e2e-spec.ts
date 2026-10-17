import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';
import { randomUUID } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('House product contributions (story 195)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: string, coordinator: string, servant: string, relative: string, houseId: string;
  const residents: string[] = [];
  const contributions: string[] = [];
  let otherHouse: string;
  let receivables: { id: string; referenceMonth: string }[];
  const get = (token: string, house = houseId, month?: string) => request(app.getHttpServer())
    .get(`${BASE}/houses/${house}/product-contributions${month ? `?referenceMonth=${month}` : ''}`)
    .set('Authorization', `Bearer ${token}`);
  const declare = async (resident: string, receivable: string, description: string, key?: string) => {
    let req = request(app.getHttpServer()).post(`${BASE}/residents/${resident}/receivables/${receivable}/product-contributions`)
      .set('Authorization', `Bearer ${servant}`);
    if (key) req = req.set('Idempotency-Key', key);
    const response = await req.send({ lines: [{ description }] }).expect(201);
    contributions.push(...response.body.map((line: { id: string }) => line.id));
    return response.body;
  };
  beforeAll(async () => {
    app = await bootstrapApp(); db = app.get(DataSource);
    ({ token: coordinator, houseId } = await loginCoordinator(app));
    admin = await login(app, 'admin@fonte.com', 'admin123');
    servant = await login(app, 'operator@fonte.com', 'operator123');
    relative = await login(app, 'familiar@fonte.com', 'familiar123');
    const createdHouse = await request(app.getHttpServer()).post(`${BASE}/houses`).set('Authorization', `Bearer ${admin}`)
      .send({ name: `Outra casa produtos ${Date.now()}` }).expect(201);
    otherHouse = createdHouse.body.id;
    for (const [index, house] of [houseId, otherHouse, houseId].entries()) {
      const response = await request(app.getHttpServer()).post(`${BASE}/residents`).set('Authorization', `Bearer ${coordinator}`)
        .send({ name: `Produtos 195 ${Date.now()} ${index}`, houseId: house, entryDate: todayInSaoPaulo(), familyInvestment: 'PAYMENT_700', contributionDueDay: 10 }).expect(201);
      residents.push(response.body.id);
    }
    const response = await request(app.getHttpServer()).get(`${BASE}/residents/${residents[0]}/receivables`).set('Authorization', `Bearer ${coordinator}`).expect(200);
    receivables = response.body;
    await declare(residents[0], receivables[0].id, 'Mês inicial');
    await declare(residents[0], receivables[1].id, 'Mês seguinte');
    const otherReceivables = await request(app.getHttpServer()).get(`${BASE}/residents/${residents[1]}/receivables`).set('Authorization', `Bearer ${coordinator}`).expect(200);
    await declare(residents[1], otherReceivables.body[0].id, 'Outra casa');
  });
  afterAll(async () => {
    if (db) await db.query('DELETE FROM receivable_product_contributions WHERE id = ANY($1)', [contributions]);
    for (const id of residents) await request(app.getHttpServer()).delete(`${BASE}/residents/${id}`).set('Authorization', `Bearer ${admin}`);
    if (otherHouse) await request(app.getHttpServer()).delete(`${BASE}/houses/${otherHouse}`).set('Authorization', `Bearer ${admin}`);
    await app?.close();
  });
  it('ADMIN, COORDINATOR and SERVANT read products without financial fields', async () => {
    for (const token of [admin, coordinator, servant]) {
      const response = await get(token, houseId, receivables[0].referenceMonth).expect(200);
      const group = response.body.find((row: { residentId: string }) => row.residentId === residents[0]);
      expect(Object.keys(group).sort()).toEqual(['lines', 'receivableId', 'referenceMonth', 'residentId', 'residentName']);
      expect(Object.keys(group.lines[0]).sort()).toEqual(['createdAt', 'createdByName', 'description', 'id', 'inventoryItemId', 'inventoryMovementId', 'pendingDetailing', 'quantity', 'receivableId', 'unit']);
      expect(response.body.some((row: { residentId: string }) => residents.slice(1).includes(row.residentId))).toBe(false);
    }
  });
  it('denies relatives, unknown houses and invalid dates', async () => {
    await get(relative).expect(403);
    await get(servant, randomUUID()).expect(404);
    await get(servant, houseId, '2026-02-30').expect(400);
    await get(servant, houseId, '2026-09').expect(400);
  });
  it('filters competence and defaults to current month', async () => {
    const current = await get(servant).expect(200);
    const first = await get(servant, houseId, receivables[0].referenceMonth).expect(200);
    const second = await get(servant, houseId, receivables[1].referenceMonth).expect(200);
    const own = (response: request.Response) => response.body.find((row: { residentId: string }) => row.residentId === residents[0]);
    expect(own(current)).toEqual(own(first));
    expect(own(first).lines.map((line: { description: string }) => line.description)).toEqual(['Mês inicial']);
    expect(own(second).lines.map((line: { description: string }) => line.description)).toEqual(['Mês seguinte']);
  });
  it('same key after lost response returns identical IDs without duplicate contribution', async () => {
    const key = randomUUID();
    const first = await declare(residents[0], receivables[0].id, 'Resposta perdida', key);
    const replay = await declare(residents[0], receivables[0].id, 'Resposta perdida', key);
    expect(replay).toEqual(first);
    const response = await get(servant).expect(200);
    const group = response.body.find((row: { residentId: string }) => row.residentId === residents[0]);
    expect(group.lines.filter((line: { description: string }) => line.description === 'Resposta perdida')).toHaveLength(1);
  });
  it('excludes soft-deleted contribution and receivable; empty house returns []', async () => {
    await db.query('UPDATE receivable_product_contributions SET deleted_at = now() WHERE id = $1', [contributions[0]]);
    await db.query('UPDATE resident_receivables SET deleted_at = now() WHERE id = $1', [receivables[1].id]);
    const first = await get(servant, houseId, receivables[0].referenceMonth).expect(200);
    expect(first.body.flatMap((row: { lines: { id: string }[] }) => row.lines).some((line: { id: string }) => line.id === contributions[0])).toBe(false);
    const second = await get(servant, houseId, receivables[1].referenceMonth).expect(200);
    expect(second.body.some((row: { residentId: string }) => row.residentId === residents[0])).toBe(false);
    expect((await get(servant, otherHouse, '2000-01-01').expect(200)).body).toEqual([]);
  });
});
