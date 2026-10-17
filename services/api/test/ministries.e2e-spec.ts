import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { FollowUpType, MINISTRY_RESIDENT_NOT_ELIGIBLE_MESSAGE, ResidentStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 205 — o vínculo filho↔ministério volta, só para filho em acolhimento
 * (ACTIVE/DISCIPLINE/TEMP_LEAVE) na casa do ministério.
 *
 * Fixtures conforme a story 182: ministérios, filhos e a casa extra são criados
 * por este arquivo (nome com `Date.now()`), removidos no `afterAll` por id
 * acumulado, e o seed é somente leitura. Nenhum DELETE por categoria.
 */
describe('Ministries — vínculo com filho (e2e, story 205)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let relativeToken: string;
  let houseId: string;
  let otherHouseId: string;
  let ministryId: string;
  const ministryIds: string[] = [];
  const residentIds: string[] = [];
  const houseIds: string[] = [];
  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createMinistry(house = houseId): Promise<string> {
    const res = await http()
      .post(`${BASE}/houses/${house}/ministries`)
      .set(auth(adminToken))
      .send({ name: `Ministério 205 ${stamp()}` })
      .expect(201);
    ministryIds.push(res.body.id);
    return res.body.id;
  }

  async function createResident(status: ResidentStatus = ResidentStatus.ACTIVE, house = houseId): Promise<string> {
    const res = await http()
      .post(`${BASE}/residents`)
      .set(auth(adminToken))
      .send({ name: `Filho Ministério ${stamp()}`, houseId: house, status })
      .expect(201);
    residentIds.push(res.body.id);
    return res.body.id;
  }

  const getMinistry = (id = ministryId) =>
    http().get(`${BASE}/ministries/${id}`).set(auth(adminToken)).expect(200);

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    relativeToken = await login(app, 'familiar@fonte.com', 'familiar123');

    const other = await http()
      .post(`${BASE}/houses`)
      .set(auth(adminToken))
      .send({ name: `Casa Ministério 205 ${stamp()}` })
      .expect(201);
    otherHouseId = other.body.id;
    houseIds.push(otherHouseId);

    ministryId = await createMinistry();
  });

  afterAll(async () => {
    // Tolera 404: o teste pode já ter removido a fixture.
    for (const id of ministryIds) {
      await http().delete(`${BASE}/ministries/${id}`).set(auth(adminToken));
    }
    for (const id of residentIds) {
      await http().delete(`${BASE}/residents/${id}`).set(auth(adminToken));
    }
    for (const id of houseIds) {
      await http().delete(`${BASE}/houses/${id}`).set(auth(adminToken));
    }
    await app.close();
  });

  // ── adicionar e remover filho ─────────────────────────────────────────────

  it('POST /ministries/:id/residents → 204; filho aparece em members e na ficha', async () => {
    const residentId = await createResident();
    await http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(adminToken))
      .send({ residentId })
      .expect(204);

    const detail = await getMinistry();
    expect(detail.body.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: residentId, role: 'FILHO' })]),
    );

    const ficha = await http().get(`${BASE}/residents/${residentId}`).set(auth(adminToken)).expect(200);
    expect(ficha.body.ministryId).toBe(ministryId);
    expect(ficha.body.ministry).toMatchObject({ id: ministryId });

    const list = await http().get(`${BASE}/houses/${houseId}/ministries`).set(auth(adminToken)).expect(200);
    const mine = list.body.find((m: { id: string }) => m.id === ministryId);
    expect(mine.filhoCount).toBeGreaterThanOrEqual(1);
    expect(mine).toHaveProperty('servoCount');
  });

  it('DELETE /ministries/:id/residents/:residentId → 204; filho sai de members', async () => {
    const residentId = await createResident(ResidentStatus.DISCIPLINE);
    await http().post(`${BASE}/ministries/${ministryId}/residents`).set(auth(adminToken)).send({ residentId }).expect(204);
    await http().delete(`${BASE}/ministries/${ministryId}/residents/${residentId}`).set(auth(adminToken)).expect(204);

    const detail = await getMinistry();
    expect(detail.body.members.some((m: { id: string }) => m.id === residentId)).toBe(false);
  });

  // ── decisão 6: guard do backend ───────────────────────────────────────────

  it('filho que já saiu (alta) → 400 com a mensagem', async () => {
    const residentId = await createResident();
    await http()
      .patch(`${BASE}/residents/${residentId}`)
      .set(auth(adminToken))
      .send({ status: ResidentStatus.DISCHARGED })
      .expect(200);

    const res = await http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(adminToken))
      .send({ residentId })
      .expect(400);
    expect(res.body.message).toBe(MINISTRY_RESIDENT_NOT_ELIGIBLE_MESSAGE);
  });

  it('filho em pré-admissão → 400', async () => {
    const residentId = await createResident(ResidentStatus.PRE_ADMISSION);
    await http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(adminToken))
      .send({ residentId })
      .expect(400);
  });

  it('filho de outra casa → 400', async () => {
    const residentId = await createResident(ResidentStatus.ACTIVE, otherHouseId);
    await http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(adminToken))
      .send({ residentId })
      .expect(400);
  });

  it('residentId inválido → 400 do ValidationPipe', () =>
    http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(adminToken))
      .send({ residentId: 'x' })
      .expect(400));

  // ── líder filho ───────────────────────────────────────────────────────────

  it('PATCH com leaderType RESIDENT de filho ativo → 200 e leaderName do filho', async () => {
    const own = await createMinistry();
    const residentId = await createResident();
    await http()
      .patch(`${BASE}/ministries/${own}`)
      .set(auth(adminToken))
      .send({ leaderId: residentId, leaderType: 'RESIDENT' })
      .expect(200);

    const detail = await getMinistry(own);
    expect(detail.body).toMatchObject({ leaderId: residentId, leaderType: 'RESIDENT' });
    expect(detail.body.leaderName).toMatch(/^Filho Ministério/);
  });

  it('PATCH com líder filho que saiu → 400 e nada persistido', async () => {
    const own = await createMinistry();
    const residentId = await createResident();
    await http().patch(`${BASE}/residents/${residentId}`).set(auth(adminToken)).send({ status: ResidentStatus.EVADED }).expect(200);

    await http()
      .patch(`${BASE}/ministries/${own}`)
      .set(auth(adminToken))
      .send({ leaderId: residentId, leaderType: 'RESIDENT' })
      .expect(400);
    const detail = await getMinistry(own);
    expect(detail.body.leaderId).toBeNull();
  });

  // ── decisão 7: saída/transferência desfaz o vínculo ───────────────────────

  it('alta pela rota de update tira o filho do ministério e da liderança', async () => {
    const own = await createMinistry();
    const residentId = await createResident();
    await http().post(`${BASE}/ministries/${own}/residents`).set(auth(adminToken)).send({ residentId }).expect(204);
    await http()
      .patch(`${BASE}/ministries/${own}`)
      .set(auth(adminToken))
      .send({ leaderId: residentId, leaderType: 'RESIDENT' })
      .expect(200);

    await http()
      .patch(`${BASE}/residents/${residentId}`)
      .set(auth(adminToken))
      .send({ status: ResidentStatus.DISCHARGED })
      .expect(200);

    const ficha = await http().get(`${BASE}/residents/${residentId}`).set(auth(adminToken)).expect(200);
    expect(ficha.body.ministryId).toBeNull();
    const detail = await getMinistry(own);
    expect(detail.body.leaderId).toBeNull();
    expect(detail.body.leaderType).toBeNull();
    expect(detail.body.members.some((m: { id: string }) => m.id === residentId)).toBe(false);

    const timeline = await http()
      .get(`${BASE}/residents/${residentId}/follow-ups`)
      .set(auth(adminToken))
      .expect(200);
    const items = Array.isArray(timeline.body) ? timeline.body : timeline.body.data;
    expect(items.some((f: { type: string }) => f.type === FollowUpType.MINISTRY_CHANGE)).toBe(true);
  });

  it('transferência de casa tira o filho do ministério', async () => {
    const own = await createMinistry();
    const residentId = await createResident();
    await http().post(`${BASE}/ministries/${own}/residents`).set(auth(adminToken)).send({ residentId }).expect(204);

    await http()
      .patch(`${BASE}/residents/${residentId}`)
      .set(auth(adminToken))
      .send({ houseId: otherHouseId })
      .expect(200);

    const ficha = await http().get(`${BASE}/residents/${residentId}`).set(auth(adminToken)).expect(200);
    expect(ficha.body.ministryId).toBeNull();
  });

  it('ministério pela ficha: PATCH /residents/:id com ministryId da casa → 200; de outra casa → 400', async () => {
    const residentId = await createResident();
    await http()
      .patch(`${BASE}/residents/${residentId}`)
      .set(auth(adminToken))
      .send({ ministryId })
      .expect(200);

    const foreign = await createMinistry(otherHouseId);
    await http()
      .patch(`${BASE}/residents/${residentId}`)
      .set(auth(adminToken))
      .send({ ministryId: foreign })
      .expect(400);

    const admissions = await http()
      .get(`${BASE}/residents/${residentId}/admissions`)
      .set(auth(adminToken))
      .expect(200);
    expect(admissions.body[0].ministryId).toBe(ministryId);
  });

  // ── roles como antes da 197 ───────────────────────────────────────────────

  it('coordenador e servo também adicionam/removem filho', async () => {
    const a = await createResident();
    const b = await createResident();
    await http().post(`${BASE}/ministries/${ministryId}/residents`).set(auth(coordToken)).send({ residentId: a }).expect(204);
    await http().post(`${BASE}/ministries/${ministryId}/residents`).set(auth(servantToken)).send({ residentId: b }).expect(204);
    await http().delete(`${BASE}/ministries/${ministryId}/residents/${a}`).set(auth(servantToken)).expect(204);
    await http().delete(`${BASE}/ministries/${ministryId}/residents/${b}`).set(auth(coordToken)).expect(204);
  });

  it('familiar → 403', async () => {
    const residentId = await createResident();
    await http()
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set(auth(relativeToken))
      .send({ residentId })
      .expect(403);
  });

  it('sem token → 401', () =>
    http().post(`${BASE}/ministries/${ministryId}/residents`).send({}).expect(401));

  // ── exclusão do ministério (soft delete) desfaz o vínculo ─────────────────

  it('excluir o ministério tira os filhos dele', async () => {
    const own = await createMinistry();
    const residentId = await createResident();
    await http().post(`${BASE}/ministries/${own}/residents`).set(auth(adminToken)).send({ residentId }).expect(204);
    await http().delete(`${BASE}/ministries/${own}`).set(auth(adminToken)).expect(204);

    const ficha = await http().get(`${BASE}/residents/${residentId}`).set(auth(adminToken)).expect(200);
    expect(ficha.body.ministryId).toBeNull();
  });
});
