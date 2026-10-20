import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

// Story 214 — ADMIN lotado na casa conta como coordenador dela: aparece em
// `coordinators`, pode ser titular e abre os fluxos de coordenador (pedido de
// capacidade, contagem). Fixtures próprias (story 182): casas + staff criados
// por API e removidos por id no afterAll; o seed é somente leitura.
describe('Admin lotado na casa é coordenador dela (e2e, story 214)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let lodgedAdminToken: string;
  let houseId: string;
  let otherHouseId: string;
  let lodgedAdminId: string;
  const stamp = Date.now();
  const houseIds: string[] = [];
  const staffIds: string[] = [];
  const residentIds: string[] = [];
  const requestIds: string[] = [];

  const http = () => request(app.getHttpServer());

  async function createHouse(name: string): Promise<string> {
    const res = await http()
      .post(`${BASE}/houses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, generalCapacity: 10, staffCapacity: 5 })
      .expect(201);
    houseIds.push(res.body.id);
    return res.body.id;
  }

  async function createStaff(name: string, role: string, house: string | null): Promise<string> {
    const res = await http()
      .post(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        email: `${name.toLowerCase()}.${stamp}@fonte.test`,
        password: 'temp12345',
        role,
        ...(house ? { houseId: house } : {}),
      })
      .expect(201);
    staffIds.push(res.body.id);
    return res.body.id;
  }

  /** Primeiro login exige trocar a senha; devolve o token já liberado. */
  async function tokenFor(name: string): Promise<string> {
    const first = await login(app, `${name.toLowerCase()}.${stamp}@fonte.test`, 'temp12345');
    const res = await http()
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${first}`)
      .send({ newPassword: 'admin21414' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const detail = (id: string) =>
    http().get(`${BASE}/houses/${id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    houseId = await createHouse(`Casa 214 ${stamp}`);
    otherHouseId = await createHouse(`Casa 214 Vizinha ${stamp}`);
    lodgedAdminId = await createStaff('AdminLotado214', 'ADMIN', houseId);
    lodgedAdminToken = await tokenFor('AdminLotado214');
  });

  afterAll(async () => {
    // Story 182: limpeza só do que esta suíte criou, por id.
    if (requestIds.length) {
      await dataSource.query('DELETE FROM house_capacity_requests WHERE id = ANY($1)', [requestIds]);
    }
    for (const id of residentIds) {
      await http().delete(`${BASE}/residents/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    for (const id of staffIds) {
      await http().delete(`${BASE}/staff/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    for (const id of houseIds) {
      await http().delete(`${BASE}/houses/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('GET /houses/:id lista o admin lotado em coordinators', async () => {
    const res = await detail(houseId);
    expect(res.body.coordinators.map((c: { id: string }) => c.id)).toEqual([lodgedAdminId]);
  });

  it('admin sem casa e admin de outra casa ficam fora da lista', async () => {
    const homeless = await createStaff('AdminSemCasa214', 'ADMIN', null);
    const neighbour = await createStaff('AdminVizinho214', 'ADMIN', otherHouseId);

    const ids = (await detail(houseId)).body.coordinators.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(homeless);
    expect(ids).not.toContain(neighbour);

    // E nenhum dos dois é elegível como titular desta casa.
    for (const staffId of [homeless, neighbour]) {
      await http()
        .patch(`${BASE}/houses/${houseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: staffId })
        .expect(400);
    }
  });

  it('PATCH /houses/:id elege o admin lotado como titular', async () => {
    await http()
      .patch(`${BASE}/houses/${houseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coordinatorId: lodgedAdminId })
      .expect(200);

    const res = await detail(houseId);
    expect(res.body.coordinatorId).toBe(lodgedAdminId);
  });

  it('admin titular que vira COORDINATOR mantém o titular', async () => {
    await http()
      .patch(`${BASE}/staff/${lodgedAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'COORDINATOR' })
      .expect(200);
    expect((await detail(houseId)).body.coordinatorId).toBe(lodgedAdminId);

    await http()
      .patch(`${BASE}/staff/${lodgedAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect((await detail(houseId)).body.coordinatorId).toBe(lodgedAdminId);
  });

  it('admin lotado abre pedido de capacidade da própria casa (antes 403)', async () => {
    const res = await http()
      .post(`${BASE}/houses/${houseId}/capacity-requests`)
      .set('Authorization', `Bearer ${lodgedAdminToken}`)
      .send({ generalCapacity: 12, staffCapacity: 6 })
      .expect(201);
    requestIds.push(res.body.id);
    expect(res.body.status).toBe('PENDING');
  });

  it('admin lotado NÃO abre pedido de capacidade de outra casa (mesma regra de vínculo)', () =>
    http()
      .post(`${BASE}/houses/${otherHouseId}/capacity-requests`)
      .set('Authorization', `Bearer ${lodgedAdminToken}`)
      .send({ generalCapacity: 12, staffCapacity: 6 })
      .expect(403));

  it('admin lotado faz a contagem: adiciona filho e conclui (antes 403)', async () => {
    const added = await http()
      .post(`${BASE}/census/residents`)
      .set('Authorization', `Bearer ${lodgedAdminToken}`)
      .send({ name: `Filho Contagem 214 ${stamp}`, houseId, entryDate: todayInSaoPaulo() })
      .expect(201);
    residentIds.push(added.body.id);
    expect(added.body.status).toBe('CENSUS_ADDED');

    const concluded = await http()
      .post(`${BASE}/census/conclude`)
      .set('Authorization', `Bearer ${lodgedAdminToken}`)
      .send({ houseId, confirmedCount: 0, total: 0 })
      .expect(201);
    expect(concluded.body.addedCount).toBe(1);
  });

  it('admin titular que vira SERVANT perde o titular', async () => {
    await http()
      .patch(`${BASE}/staff/${lodgedAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SERVANT' })
      .expect(200);

    const res = await detail(houseId);
    expect(res.body.coordinatorId).toBeNull();
    expect(res.body.coordinators).toEqual([]);
  });
});
