import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { io, Socket } from 'socket.io-client';
import { DailyBoard, DailyPerson, ResidentStatus, Role } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 225 — Daily (board de ministérios em tempo real).
 *
 * Fixtures próprias (story 182): casa, coordenador, servo, filhos e
 * ministérios criados por este arquivo e removidos por id no `afterAll`; as
 * sessões da daily são da casa criada aqui e saem por id. O seed é só leitura.
 */
function waitForEvent(socket: Socket, event: string, timeoutMs = 4000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Daily — board de ministérios (e2e, story 225)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let url: string;
  let adminToken: string;
  let coordToken: string;
  let seedCoordToken: string;
  let servantToken: string;
  let houseId: string;
  let otherHouseId: string;
  let ministryA: string;
  let ministryB: string;
  let foreignMinistry: string;
  let residentA: string;
  let residentB: string;
  let servantId: string;
  let coordId: string;
  let sessionId: string;
  const stamp = `${Date.now()}`;
  const houseIds: string[] = [];
  const staffIds: string[] = [];
  const residentIds: string[] = [];
  const ministryIds: string[] = [];
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createHouse(name: string): Promise<string> {
    const res = await http().post(`${BASE}/houses`).set(auth(adminToken)).send({ name }).expect(201);
    houseIds.push(res.body.id);
    return res.body.id;
  }

  async function createStaff(name: string, role: Role, house: string): Promise<string> {
    const res = await http()
      .post(`${BASE}/staff`)
      .set(auth(adminToken))
      .send({ name, email: `${name.toLowerCase()}.${stamp}@fonte.test`, password: 'temp12345', role, houseId: house })
      .expect(201);
    staffIds.push(res.body.id);
    return res.body.id;
  }

  async function tokenFor(name: string): Promise<string> {
    const first = await login(app, `${name.toLowerCase()}.${stamp}@fonte.test`, 'temp12345');
    const res = await http()
      .post(`${BASE}/auth/change-password`)
      .set(auth(first))
      .send({ newPassword: 'daily22514' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createMinistry(name: string, house = houseId): Promise<string> {
    const res = await http()
      .post(`${BASE}/houses/${house}/ministries`)
      .set(auth(adminToken))
      .send({ name })
      .expect(201);
    ministryIds.push(res.body.id);
    return res.body.id;
  }

  async function createResident(name: string): Promise<string> {
    const res = await http()
      .post(`${BASE}/residents`)
      .set(auth(adminToken))
      .send({ name, houseId, status: ResidentStatus.ACTIVE })
      .expect(201);
    residentIds.push(res.body.id);
    return res.body.id;
  }

  function connect(token: string): Socket {
    const socket = io(`${url}/daily`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  const getBoard = (token = coordToken) =>
    http().get(`${BASE}/daily/current`).set(auth(token)).expect(200).then((r) => r.body as DailyBoard);

  const findIn = (board: DailyBoard, id: string): { box: string | null; person: DailyPerson } | null => {
    const un = board.unassigned.find((p) => p.id === id);
    if (un) return { box: null, person: un };
    for (const m of board.ministries) {
      const p = m.members.find((x) => x.id === id);
      if (p) return { box: m.id, person: p };
    }
    return null;
  };

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `http://127.0.0.1:${port}`;

    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: seedCoordToken } = await loginCoordinator(app));

    houseId = await createHouse(`Casa Daily ${stamp}`);
    otherHouseId = await createHouse(`Casa Daily Vizinha ${stamp}`);
    coordId = await createStaff(`CoordDaily${stamp}`, Role.COORDINATOR, houseId);
    coordToken = await tokenFor(`CoordDaily${stamp}`);
    servantId = await createStaff(`ServoDaily${stamp}`, Role.SERVANT, houseId);

    ministryA = await createMinistry(`Cozinha Daily ${stamp}`);
    ministryB = await createMinistry(`Horta Daily ${stamp}`);
    foreignMinistry = await createMinistry(`Vizinho Daily ${stamp}`, otherHouseId);

    residentA = await createResident(`Filho Daily A ${stamp}`);
    residentB = await createResident(`Filho Daily B ${stamp}`);
    await http().post(`${BASE}/ministries/${ministryA}/residents`).set(auth(adminToken)).send({ residentId: residentA }).expect(204);
    // Servo em dois ministérios: entra no vínculo mais antigo (A).
    await http().post(`${BASE}/ministries/${ministryA}/staff`).set(auth(adminToken)).send({ staffId: servantId }).expect(204);
    await http().post(`${BASE}/ministries/${ministryB}/staff`).set(auth(adminToken)).send({ staffId: servantId }).expect(204);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    if (houseIds.length) {
      await dataSource.query('DELETE FROM daily_sessions WHERE house_id = ANY($1)', [houseIds]);
    }
    for (const id of ministryIds) await http().delete(`${BASE}/ministries/${id}`).set(auth(adminToken));
    for (const id of residentIds) await http().delete(`${BASE}/residents/${id}`).set(auth(adminToken));
    for (const id of staffIds) await http().delete(`${BASE}/staff/${id}`).set(auth(adminToken));
    for (const id of houseIds) await http().delete(`${BASE}/houses/${id}`).set(auth(adminToken));
    await app.close();
  });

  it('GET /daily/current → board pré-preenchido com o estado real', async () => {
    const board = await getBoard();
    sessionId = board.session.id;
    expect(board.session).toMatchObject({ status: 'OPEN', houseId, version: 0 });
    expect(board.ministries.map((m) => m.id)).toEqual(expect.arrayContaining([ministryA, ministryB]));

    expect(findIn(board, residentA)?.box).toBe(ministryA);
    expect(findIn(board, residentB)?.box).toBeNull();
    const servant = findIn(board, servantId);
    expect(servant?.box).toBe(ministryA);
    expect(servant?.person).toMatchObject({ type: 'STAFF', hadMultipleMinistries: true, roleLabel: 'Servo' });
    const coord = findIn(board, coordId);
    expect(coord?.box).toBeNull();
    expect(coord?.person.roleLabel).toBe('Coordenador');
  });

  it('segundo GET no mesmo dia devolve a mesma sessão', async () => {
    expect((await getBoard()).session.id).toBe(sessionId);
  });

  it('ADMIN abre a daily de qualquer casa; coordenador de outra casa e servo → 403', async () => {
    const admin = await http().get(`${BASE}/daily/current`).query({ houseId }).set(auth(adminToken)).expect(200);
    expect(admin.body.session.id).toBe(sessionId);
    await http().get(`${BASE}/daily/current`).query({ houseId }).set(auth(seedCoordToken)).expect(403);
    await http().get(`${BASE}/daily/current`).set(auth(servantToken)).expect(403);
    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(servantToken))
      .send({ personType: 'RESIDENT', personId: residentB, toMinistryId: ministryB })
      .expect(403);
    await http().post(`${BASE}/daily-sessions/${sessionId}/apply`).set(auth(seedCoordToken)).expect(403);
  });

  it('move de um aparelho chega como daily:moved no outro', async () => {
    const a = connect(coordToken);
    const b = connect(coordToken);
    await Promise.all([waitForEvent(a, 'connect'), waitForEvent(b, 'connect')]);
    const joinedA = waitForEvent(a, 'daily:joined');
    const joinedB = waitForEvent(b, 'daily:joined');
    a.emit('daily:join', { sessionId });
    b.emit('daily:join', { sessionId });
    await Promise.all([joinedA, joinedB]);

    const received = waitForEvent(b, 'daily:moved');
    const res = await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'RESIDENT', personId: residentB, toMinistryId: ministryB })
      .expect(200);
    expect(res.body.version).toBe(1);
    expect(await received).toMatchObject({ personId: residentB, toMinistryId: ministryB, version: 1 });
  });

  it('servo não entra na room: daily:join → daily:error', async () => {
    const s = connect(servantToken);
    await waitForEvent(s, 'connect');
    const error = waitForEvent(s, 'daily:error');
    s.emit('daily:join', { sessionId });
    expect(await error).toHaveProperty('message');
  });

  it('moves: servo para B, coordenador para "Sem ministério"; inválidos → 400', async () => {
    const r1 = await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'STAFF', personId: servantId, toMinistryId: ministryB })
      .expect(200);
    expect(r1.body.version).toBe(2);
    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'RESIDENT', personId: residentA, toMinistryId: null })
      .expect(200);

    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'RESIDENT', personId: residentA, toMinistryId: foreignMinistry })
      .expect(400);
    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'RESIDENT', personId: servantId, toMinistryId: ministryA })
      .expect(400);
    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'X', personId: 'y' })
      .expect(400);

    const board = await getBoard();
    expect(findIn(board, servantId)?.box).toBe(ministryB);
    expect(findIn(board, residentA)?.box).toBeNull();
    // Rascunho: os ministérios reais ainda não mudaram.
    const real = await http().get(`${BASE}/ministries/${ministryA}`).set(auth(adminToken)).expect(200);
    expect(real.body.members.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining([residentA, servantId]));
  });

  it('apply grava nos ministérios; aplicar de novo → 409; move em sessão aplicada → 409', async () => {
    const res = await http().post(`${BASE}/daily-sessions/${sessionId}/apply`).set(auth(coordToken)).expect(200);
    // residentB → B, servo fica só em B (perde A), residentA sai de A.
    expect(res.body).toEqual({ applied: 3, skipped: [] });

    const a = await http().get(`${BASE}/ministries/${ministryA}`).set(auth(adminToken)).expect(200);
    const b = await http().get(`${BASE}/ministries/${ministryB}`).set(auth(adminToken)).expect(200);
    const idsA = a.body.members.map((m: { id: string }) => m.id);
    const idsB = b.body.members.map((m: { id: string }) => m.id);
    expect(idsA).not.toContain(residentA);
    expect(idsA).not.toContain(servantId);
    expect(idsB).toEqual(expect.arrayContaining([residentB, servantId]));

    await http().post(`${BASE}/daily-sessions/${sessionId}/apply`).set(auth(coordToken)).expect(409);
    await http()
      .post(`${BASE}/daily-sessions/${sessionId}/moves`)
      .set(auth(coordToken))
      .send({ personType: 'RESIDENT', personId: residentB, toMinistryId: null })
      .expect(409);

    const board = await getBoard();
    expect(board.session).toMatchObject({ id: sessionId, status: 'APPLIED' });
    expect(board.session.appliedByName).toBe(`CoordDaily${stamp}`);
  });

  it('POST /daily abre nova sessão pré-preenchida do estado aplicado', async () => {
    const res = await http().post(`${BASE}/daily`).set(auth(coordToken)).send({}).expect(201);
    const board = res.body as DailyBoard;
    expect(board.session.id).not.toBe(sessionId);
    expect(board.session.status).toBe('OPEN');
    expect(findIn(board, residentB)?.box).toBe(ministryB);
    expect(findIn(board, servantId)?.person.hadMultipleMinistries).toBe(false);
  });
});
