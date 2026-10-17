import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ServantRank } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

/**
 * Story 207 — nível do servo no `ops`: `GET /houses/:id/staff` devolve `rank` e
 * os ministérios (lista e detalhe) devolvem `leaderRank`.
 *
 * Fixtures conforme a story 182: casa, servos, filho e ministérios criados por
 * este arquivo (nome com `Date.now()`), removidos no `afterAll` por id
 * acumulado. O seed é somente leitura — o SERVANT do seed só lê.
 */
describe('Nível do servo (e2e, story 207)', () => {
  let app: INestApplication;
  let adminToken: string;
  let servantToken: string;
  let houseId: string;
  let rankedId: string;
  let coordId: string;
  let staffLedId: string;
  let residentLedId: string;
  let unledId: string;
  const stamp = Date.now();
  const houseIds: string[] = [];
  const staffIds: string[] = [];
  const residentIds: string[] = [];
  const ministryIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createStaff(
    name: string,
    role: 'COORDINATOR' | 'SERVANT',
    rank?: ServantRank,
  ): Promise<string> {
    const res = await http()
      .post(`${BASE}/staff`)
      .set(auth(adminToken))
      .send({
        name,
        email: `${name.toLowerCase()}.${stamp}@fonte.test`,
        password: 'secret123',
        role,
        houseId,
        ...(rank ? { rank } : {}),
      })
      .expect(201);
    staffIds.push(res.body.id);
    return res.body.id;
  }

  async function createMinistry(
    name: string,
    leader?: { leaderId: string; leaderType: 'STAFF' | 'RESIDENT' },
  ): Promise<string> {
    const res = await http()
      .post(`${BASE}/houses/${houseId}/ministries`)
      .set(auth(adminToken))
      .send({ name: `${name} 207 ${stamp}` })
      .expect(201);
    ministryIds.push(res.body.id);
    if (leader) {
      await http().patch(`${BASE}/ministries/${res.body.id}`).set(auth(adminToken)).send(leader).expect(200);
    }
    return res.body.id;
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');

    const house = await http()
      .post(`${BASE}/houses`)
      .set(auth(adminToken))
      .send({ name: `Casa 207 ${stamp}` })
      .expect(201);
    houseId = house.body.id;
    houseIds.push(houseId);

    rankedId = await createStaff('Consagrado207', 'SERVANT', ServantRank.CONSAGRADO);
    coordId = await createStaff('Coord207', 'COORDINATOR');

    const resident = await http()
      .post(`${BASE}/residents`)
      .set(auth(adminToken))
      .send({ name: `Filho 207 ${stamp}`, houseId, status: 'ACTIVE' })
      .expect(201);
    residentIds.push(resident.body.id);

    staffLedId = await createMinistry('Cozinha', { leaderId: rankedId, leaderType: 'STAFF' });
    residentLedId = await createMinistry('Horta', { leaderId: resident.body.id, leaderType: 'RESIDENT' });
    unledId = await createMinistry('Limpeza');
  });

  afterAll(async () => {
    // Tolera 404: o teste pode já ter removido a fixture.
    for (const id of ministryIds) await http().delete(`${BASE}/ministries/${id}`).set(auth(adminToken));
    for (const id of residentIds) await http().delete(`${BASE}/residents/${id}`).set(auth(adminToken));
    for (const id of staffIds) await http().delete(`${BASE}/staff/${id}`).set(auth(adminToken));
    for (const id of houseIds) await http().delete(`${BASE}/houses/${id}`).set(auth(adminToken));
    await app.close();
  });

  it('GET /houses/:id/staff como SERVANT → 200 com rank do servo e null para coordenador', async () => {
    const res = await http().get(`${BASE}/houses/${houseId}/staff`).set(auth(servantToken)).expect(200);
    const byId = new Map(res.body.map((s: { id: string }) => [s.id, s]));
    expect(byId.get(rankedId)).toMatchObject({ role: 'SERVANT', rank: ServantRank.CONSAGRADO });
    expect(byId.get(coordId)).toMatchObject({ role: 'COORDINATOR', rank: null });
  });

  it('GET /ministries/:id como SERVANT → 200 com leaderRank do líder servo', async () => {
    const res = await http().get(`${BASE}/ministries/${staffLedId}`).set(auth(servantToken)).expect(200);
    expect(res.body).toMatchObject({ leaderType: 'STAFF', leaderRank: ServantRank.CONSAGRADO });
  });

  it('GET /ministries/:id → leaderRank null para líder filho e sem líder', async () => {
    const residentLed = await http().get(`${BASE}/ministries/${residentLedId}`).set(auth(servantToken)).expect(200);
    expect(residentLed.body).toMatchObject({ leaderType: 'RESIDENT', leaderRank: null });
    const unled = await http().get(`${BASE}/ministries/${unledId}`).set(auth(servantToken)).expect(200);
    expect(unled.body).toMatchObject({ leaderType: null, leaderRank: null });
  });

  it('GET /houses/:id/ministries → leaderRank na listagem', async () => {
    const res = await http().get(`${BASE}/houses/${houseId}/ministries`).set(auth(servantToken)).expect(200);
    const byId = new Map(res.body.map((m: { id: string }) => [m.id, m]));
    expect(byId.get(staffLedId)).toMatchObject({ leaderRank: ServantRank.CONSAGRADO });
    expect(byId.get(residentLedId)).toMatchObject({ leaderRank: null });
    expect(byId.get(unledId)).toMatchObject({ leaderRank: null });
  });
});
