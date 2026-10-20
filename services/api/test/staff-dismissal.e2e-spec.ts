import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditAction, Role, STAFF_DISMISSAL_MESSAGES, StaffDismissalReason } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 217 — desligamento e reintegração de servo (só ADMIN).
 * Fixtures próprias (casa, coordenador titular e ministério), criadas via API e
 * removidas por id no `afterAll` (story 182). Datas fixas no passado.
 */
describe('Desligamento e reintegração de servo (e2e, story 217)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  let ministryId: string;
  let staffId: string;
  let email: string;
  const password = 'senha123';
  const staffIds: string[] = [];
  const userIds: string[] = [];
  const houseIds: string[] = [];
  const ministryIds: string[] = [];

  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const server = () => app.getHttpServer();
  const as = (token: string, req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const dismiss = (token: string, body: object) =>
    as(token, request(server()).post(`${BASE}/staff/${staffId}/dismiss`)).send(body);
  const reinstate = (token: string, body: object) =>
    as(token, request(server()).post(`${BASE}/staff/${staffId}/reinstate`)).send(body);
  const listIds = async (query = '') => {
    const res = await as(adminToken, request(server()).get(`${BASE}/staff${query}`)).expect(200);
    return res.body.map((s: { id: string }) => s.id);
  };

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: coordToken } = await loginCoordinator(app));

    const house = await as(adminToken, request(server()).post(`${BASE}/houses`)).send({
      name: `Casa Desligamento ${stamp()}`,
    });
    expect(house.status).toBe(201);
    houseId = house.body.id;
    houseIds.push(houseId);

    email = `deslig-${stamp()}@fonte.test`;
    const created = await as(adminToken, request(server()).post(`${BASE}/staff`)).send({
      name: `Coord Desligamento ${stamp()}`,
      email,
      password,
      role: Role.COORDINATOR,
      houseId,
    });
    expect(created.status).toBe(201);
    staffId = created.body.id;
    staffIds.push(staffId);
    userIds.push(created.body.userId);

    // Início do período aberto no passado, para as datas fixas do desligamento.
    const periods = await as(adminToken, request(server()).get(`${BASE}/staff/${staffId}/service-periods`));
    await as(adminToken, request(server()).patch(`${BASE}/staff/${staffId}/service-periods/${periods.body[0].id}`))
      .send({ startDate: '2024-01-01' })
      .expect(200);

    await as(adminToken, request(server()).patch(`${BASE}/houses/${houseId}`))
      .send({ coordinatorId: staffId })
      .expect(200);

    const ministry = await as(adminToken, request(server()).post(`${BASE}/houses/${houseId}/ministries`)).send({
      name: `Ministério ${stamp()}`,
    });
    expect(ministry.status).toBe(201);
    ministryId = ministry.body.id;
    ministryIds.push(ministryId);
    await as(adminToken, request(server()).patch(`${BASE}/ministries/${ministryId}`))
      .send({ leaderId: staffId, leaderType: 'STAFF' })
      .expect(200);
  });

  afterAll(async () => {
    if (ministryIds.length) await dataSource.query('DELETE FROM ministries WHERE id = ANY($1)', [ministryIds]);
    if (houseIds.length) {
      await dataSource.query('UPDATE houses SET coordinator_id = NULL WHERE id = ANY($1)', [houseIds]);
    }
    if (staffIds.length) {
      await dataSource.query('DELETE FROM staff_service_periods WHERE staff_id = ANY($1)', [staffIds]);
      await dataSource.query('DELETE FROM staff WHERE id = ANY($1)', [staffIds]);
    }
    if (userIds.length) await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    for (const id of houseIds) {
      await as(adminToken, request(server()).delete(`${BASE}/houses/${id}`));
    }
    await app.close();
  });

  it('COORDINATOR e SERVANT → 403 em desligar e reintegrar', async () => {
    const body = { date: '2025-01-10', reason: StaffDismissalReason.OWN_REQUEST };
    expect((await dismiss(coordToken, body)).status).toBe(403);
    expect((await dismiss(servantToken, body)).status).toBe(403);
    expect((await reinstate(coordToken, { date: '2025-02-01' })).status).toBe(403);
    expect((await reinstate(servantToken, { date: '2025-02-01' })).status).toBe(403);
  });

  it('validações: OTHER sem observação, data futura, antes do início, motivo inválido → 400', async () => {
    const other = await dismiss(adminToken, { date: '2025-01-10', reason: StaffDismissalReason.OTHER });
    expect(other.status).toBe(400);
    expect(other.body.message).toBe(STAFF_DISMISSAL_MESSAGES.notesRequired);

    const future = await dismiss(adminToken, { date: '2999-01-01', reason: StaffDismissalReason.OWN_REQUEST });
    expect(future.status).toBe(400);
    expect(future.body.message).toBe(STAFF_DISMISSAL_MESSAGES.dateFuture);

    const before = await dismiss(adminToken, { date: '2023-12-31', reason: StaffDismissalReason.OWN_REQUEST });
    expect(before.status).toBe(400);
    expect(before.body.message).toBe(STAFF_DISMISSAL_MESSAGES.dateBeforeStart('2024-01-01'));

    expect((await dismiss(adminToken, { date: '2025-01-10', reason: 'NOPE' })).status).toBe(400);
    expect((await reinstate(adminToken, { date: '2025-02-01' })).status).toBe(409);
  });

  it('ADMIN desliga → 200 com dismissedAt; efeitos colaterais na mesma transação', async () => {
    const res = await dismiss(adminToken, {
      date: '2025-01-10',
      reason: StaffDismissalReason.OTHER,
      notes: 'Mudou de cidade',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: staffId, dismissedAt: '2025-01-10', houseId });

    const detail = await as(adminToken, request(server()).get(`${BASE}/staff/${staffId}`)).expect(200);
    expect(detail.body.dismissedAt).toBe('2025-01-10');

    const house = await as(adminToken, request(server()).get(`${BASE}/houses/${houseId}`)).expect(200);
    expect(house.body.coordinatorId).toBeNull();
    expect(house.body.coordinators).toEqual([]);
    expect(house.body.staffCount).toBe(0);

    const houseStaff = await as(adminToken, request(server()).get(`${BASE}/houses/${houseId}/staff`)).expect(200);
    expect(houseStaff.body).toEqual([]);

    const ministry = await as(adminToken, request(server()).get(`${BASE}/ministries/${ministryId}`)).expect(200);
    expect(ministry.body.leaderId).toBeNull();

    const [user] = await dataSource.query('SELECT is_active, deleted_at FROM users WHERE id = $1', [userIds[0]]);
    expect(user).toEqual({ is_active: false, deleted_at: null });

    const logs = await dataSource.query('SELECT action FROM audit_logs WHERE target_id = $1', [staffId]);
    expect(logs.map((l: { action: string }) => l.action)).toContain(AuditAction.STAFF_DISMISS);
  });

  it('lista: fora do default, dentro de ?status=dismissed; filtro inválido → 400', async () => {
    expect(await listIds()).not.toContain(staffId);
    expect(await listIds('?status=active')).not.toContain(staffId);
    expect(await listIds('?status=dismissed')).toContain(staffId);
    await as(adminToken, request(server()).get(`${BASE}/staff?status=nope`)).expect(400);
  });

  it('login do desligado → 401; desligar de novo → 409', async () => {
    await request(server()).post(`${BASE}/auth/login`).send({ identifier: email, password }).expect(401);
    const again = await dismiss(adminToken, { date: '2025-01-10', reason: StaffDismissalReason.OWN_REQUEST });
    expect(again.status).toBe(409);
  });

  it('Histórico mostra o motivo no período encerrado', async () => {
    const res = await as(adminToken, request(server()).get(`${BASE}/staff/${staffId}/service-periods`)).expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        startDate: '2024-01-01',
        endDate: '2025-01-10',
        endReason: StaffDismissalReason.OTHER,
        endNotes: 'Mudou de cidade',
      }),
    ]);
  });

  it('reintegrar antes do fim do último período → 400; ADMIN reintegra → dois períodos', async () => {
    const early = await reinstate(adminToken, { date: '2025-01-09' });
    expect(early.status).toBe(400);
    expect(early.body.message).toBe(STAFF_DISMISSAL_MESSAGES.reinstateBeforeLastEnd('2025-01-10'));

    const res = await reinstate(adminToken, { date: '2025-02-01', houseId });
    expect(res.status).toBe(200);
    expect(res.body.dismissedAt).toBeNull();

    const periods = await as(adminToken, request(server()).get(`${BASE}/staff/${staffId}/service-periods`)).expect(200);
    expect(periods.body).toEqual([
      expect.objectContaining({ startDate: '2025-02-01', endDate: null, houseId, endReason: null }),
      expect.objectContaining({ startDate: '2024-01-01', endDate: '2025-01-10' }),
    ]);

    expect(await listIds()).toContain(staffId);
    await request(server()).post(`${BASE}/auth/login`).send({ identifier: email, password }).expect(200);
    expect((await reinstate(adminToken, { date: '2025-02-01' })).status).toBe(409);
  });
});
