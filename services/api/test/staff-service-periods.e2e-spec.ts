import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditAction, ResidentStatus, Role, SERVICE_PERIOD_MESSAGES, todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 216 — período de serviço do servo na aba Histórico.
 * Fixtures próprias (servo direto e filho promovido), criadas via API e
 * removidas por id no `afterAll` (story 182). Datas fixas no passado.
 */
describe('Períodos de serviço do servo (e2e, story 216)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  let staffId: string;
  let openPeriodId: string;
  const staffIds: string[] = [];
  const userIds: string[] = [];
  const residentIds: string[] = [];

  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const server = () => app.getHttpServer();
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  const list = (token: string, id = staffId) =>
    request(server()).get(`${BASE}/staff/${id}/service-periods`).set('Authorization', `Bearer ${token}`);
  const create = (token: string, body: object, id = staffId) =>
    request(server()).post(`${BASE}/staff/${id}/service-periods`).set('Authorization', `Bearer ${token}`).send(body);
  const update = (token: string, periodId: string, body: object, id = staffId) =>
    request(server())
      .patch(`${BASE}/staff/${id}/service-periods/${periodId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));

    const created = await asAdmin(request(server()).post(`${BASE}/staff`)).send({
      name: `Servo Periodo ${stamp()}`,
      password: 'senha123',
      role: Role.SERVANT,
      houseId,
    });
    expect(created.status).toBe(201);
    staffId = created.body.id;
    staffIds.push(staffId);
    userIds.push(created.body.userId);
  });

  afterAll(async () => {
    if (residentIds.length) {
      const promoted = await dataSource.query<{ id: string; user_id: string }[]>(
        'SELECT id, user_id FROM staff WHERE former_resident_id = ANY($1)',
        [residentIds],
      );
      staffIds.push(...promoted.map((row) => row.id));
      userIds.push(...promoted.map((row) => row.user_id));
    }
    if (staffIds.length) {
      await dataSource.query('DELETE FROM staff_service_periods WHERE staff_id = ANY($1)', [staffIds]);
      await dataSource.query('DELETE FROM staff WHERE id = ANY($1)', [staffIds]);
    }
    if (residentIds.length) {
      await dataSource.query('DELETE FROM resident_follow_ups WHERE resident_id = ANY($1)', [residentIds]);
      await dataSource.query('DELETE FROM admissions WHERE resident_id = ANY($1)', [residentIds]);
      await dataSource.query('DELETE FROM residents WHERE id = ANY($1)', [residentIds]);
    }
    if (userIds.length) await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    await app.close();
  });

  it('cadastro direto abre período em andamento com início = hoje', async () => {
    const res = await list(adminToken).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ staffId, houseId, startDate: todayInSaoPaulo(), endDate: null });
    expect(res.body[0].house?.id).toBe(houseId);
    openPeriodId = res.body[0].id;
  });

  it('promover filho de fixture → período aberto com início = data da promoção', async () => {
    const resident = await asAdmin(request(server()).post(`${BASE}/residents`)).send({
      name: `Periodo Filho ${stamp()}`,
      houseId,
      status: ResidentStatus.ACTIVE,
      entryDate: '2025-01-10',
    });
    expect(resident.status).toBe(201);
    residentIds.push(resident.body.id);

    const promoted = await request(server())
      .post(`${BASE}/residents/${resident.body.id}/promote-to-servant`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ password: 'senha123', date: '2025-03-01' });
    expect(promoted.status).toBe(201);

    const res = await list(adminToken, promoted.body.id).expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({ houseId, startDate: '2025-03-01', endDate: null }),
    ]);
  });

  it('COORDINATOR e SERVANT leem (200) mas não escrevem (403)', async () => {
    expect((await list(coordToken)).status).toBe(200);
    expect((await list(servantToken)).status).toBe(200);
    const body = { houseId, startDate: '2020-01-01', endDate: '2020-06-01' };
    expect((await create(coordToken, body)).status).toBe(403);
    expect((await create(servantToken, body)).status).toBe(403);
    expect((await update(coordToken, openPeriodId, { startDate: '2020-01-01' })).status).toBe(403);
    expect((await update(servantToken, openPeriodId, { startDate: '2020-01-01' })).status).toBe(403);
  });

  let oldPeriodId: string;

  it('ADMIN cria período antigo encerrado → 201, auditado com o servo como principal', async () => {
    const res = await create(adminToken, { houseId, startDate: '2020-01-01', endDate: '2020-06-01' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ staffId, houseId, startDate: '2020-01-01', endDate: '2020-06-01' });
    oldPeriodId = res.body.id;

    const logs = await dataSource.query('SELECT action, parent_id FROM audit_logs WHERE target_id = $1', [oldPeriodId]);
    expect(logs).toEqual([{ action: AuditAction.STAFF_SERVICE_PERIOD_CREATE, parent_id: staffId }]);

    const all = await list(adminToken).expect(200);
    expect(all.body.map((p: { id: string }) => p.id)).toEqual([openPeriodId, oldPeriodId]);
  });

  it('ADMIN edita o encerrado → 200; sobreposição e sem fim → 400', async () => {
    const ok = await update(adminToken, oldPeriodId, { endDate: '2020-07-15', houseId: null });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ endDate: '2020-07-15', houseId: null });

    const overlap = await create(adminToken, { startDate: '2020-05-01', endDate: '2020-12-01' });
    expect(overlap.status).toBe(400);
    expect(overlap.body.message).toBe(SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-07-15'));

    const noEnd = await create(adminToken, { startDate: '2019-01-01' });
    expect(noEnd.status).toBe(400);
    expect(noEnd.body.message).toBe(SERVICE_PERIOD_MESSAGES.alreadyOpen);
  });

  it('aberto: fim → 400; só início → 200', async () => {
    const forbidden = await update(adminToken, openPeriodId, { endDate: '2024-01-01' });
    expect(forbidden.status).toBe(400);
    expect(forbidden.body.message).toBe(SERVICE_PERIOD_MESSAGES.openOnlyStartDate);

    const ok = await update(adminToken, openPeriodId, { startDate: '2021-01-01' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ startDate: '2021-01-01', endDate: null });
  });

  it('período de outro staff → 404', async () => {
    const promotedStaff = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM staff WHERE former_resident_id = ANY($1)',
      [residentIds],
    );
    const res = await update(adminToken, oldPeriodId, { startDate: '2020-01-02' }, promotedStaff[0].id);
    expect(res.status).toBe(404);
  });
});
