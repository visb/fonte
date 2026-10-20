import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ADMISSION_HISTORY_MESSAGES, AuditAction, ResidentStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 215 — criar e editar acolhimentos pela aba Histórico (só ADMIN).
 * Fixture própria: filho criado via API, passagens criadas pelo endpoint novo;
 * tudo removido por id no `afterAll` (story 182). Datas fixas no passado.
 */
describe('Acolhimentos do Histórico (e2e, story 215)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  let residentId: string;
  let currentAdmissionId: string;
  const residentIds: string[] = [];
  const admissionIds: string[] = [];

  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const server = () => app.getHttpServer();
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));

    const created = await asAdmin(request(server()).post(`${BASE}/residents`)).send({
      name: `Historico Filho ${stamp()}`,
      houseId,
      status: ResidentStatus.ACTIVE,
      entryDate: '2025-01-10',
    });
    expect(created.status).toBe(201);
    residentId = created.body.id;
    residentIds.push(residentId);

    const list = await asAdmin(request(server()).get(`${BASE}/residents/${residentId}/admissions`)).expect(200);
    currentAdmissionId = list.body[0].id;
  });

  afterAll(async () => {
    if (admissionIds.length) {
      await dataSource.query('DELETE FROM admissions WHERE id = ANY($1)', [admissionIds]);
    }
    for (const id of residentIds) {
      await asAdmin(request(server()).delete(`${BASE}/residents/${id}`));
    }
    await app.close();
  });

  const createAdmission = (token: string, body: object) =>
    request(server())
      .post(`${BASE}/residents/${residentId}/admissions`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const updateAdmission = (token: string, admissionId: string, body: object) =>
    request(server())
      .patch(`${BASE}/residents/${residentId}/admissions/${admissionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const oldPassage = {
    entryDate: '2022-03-01',
    exitDate: '2022-09-01',
    status: ResidentStatus.DISCHARGED,
  };

  it('ADMIN cria passagem antiga → 201, aparece na lista e é auditada', async () => {
    const res = await createAdmission(adminToken, { ...oldPassage, houseId });
    expect(res.status).toBe(201);
    admissionIds.push(res.body.id);
    expect(res.body).toMatchObject({ residentId, houseId, status: ResidentStatus.DISCHARGED });
    expect(res.body.house?.id).toBe(houseId);

    const list = await asAdmin(request(server()).get(`${BASE}/residents/${residentId}/admissions`)).expect(200);
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([currentAdmissionId, res.body.id]);

    const logs = await dataSource.query(
      'SELECT action, parent_id FROM audit_logs WHERE target_id = $1',
      [res.body.id],
    );
    expect(logs).toEqual([{ action: AuditAction.ADMISSION_CREATE, parent_id: residentId }]);
  });

  it('COORDINATOR e SERVANT → 403 em criar e editar', async () => {
    expect((await createAdmission(coordToken, { ...oldPassage, houseId })).status).toBe(403);
    expect((await createAdmission(servantToken, { ...oldPassage, houseId })).status).toBe(403);
    const target = admissionIds[0];
    expect((await updateAdmission(coordToken, target, { exitDate: '2022-08-01' })).status).toBe(403);
    expect((await updateAdmission(servantToken, target, { exitDate: '2022-08-01' })).status).toBe(403);
  });

  it('ADMIN edita a saída da passagem antiga → 200', async () => {
    const res = await updateAdmission(adminToken, admissionIds[0], {
      exitDate: '2022-10-15',
      status: ResidentStatus.EVADED,
    });
    expect(res.status).toBe(200);
    expect(res.body.exitDate).toBe('2022-10-15');
    expect(res.body.status).toBe(ResidentStatus.EVADED);
  });

  it('sobreposição → 400 com a mensagem', async () => {
    const res = await createAdmission(adminToken, {
      houseId,
      entryDate: '2022-10-01',
      exitDate: '2022-12-01',
      status: ResidentStatus.DISCHARGED,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ADMISSION_HISTORY_MESSAGES.overlap('2022-03-01', '2022-10-15'));
  });

  it('sem saída → 400 (DTO); status não terminal → 400', async () => {
    const noExit = await createAdmission(adminToken, { houseId, entryDate: '2021-01-01', status: 'DISCHARGED' });
    expect(noExit.status).toBe(400);
    const active = await createAdmission(adminToken, { ...oldPassage, houseId, entryDate: '2021-01-01', exitDate: '2021-02-01', status: ResidentStatus.ACTIVE });
    expect(active.status).toBe(400);
    expect(active.body.message).toBe(ADMISSION_HISTORY_MESSAGES.exitStatusRequired);
  });

  it('atual: outro campo → 400; só entrada → 200 e espelha na ficha', async () => {
    const forbidden = await updateAdmission(adminToken, currentAdmissionId, { houseId });
    expect(forbidden.status).toBe(400);
    expect(forbidden.body.message).toBe(ADMISSION_HISTORY_MESSAGES.currentOnlyEntryDate);

    const ok = await updateAdmission(adminToken, currentAdmissionId, { entryDate: '2025-01-05' });
    expect(ok.status).toBe(200);
    expect(ok.body.entryDate).toBe('2025-01-05');

    const resident = await asAdmin(request(server()).get(`${BASE}/residents/${residentId}`)).expect(200);
    expect(String(resident.body.entryDate).slice(0, 10)).toBe('2025-01-05');
  });

  it('admission de outro filho → 404', async () => {
    const other = await asAdmin(request(server()).post(`${BASE}/residents`)).send({
      name: `Historico Outro ${stamp()}`,
      houseId,
      status: ResidentStatus.ACTIVE,
      entryDate: '2025-02-01',
    });
    expect(other.status).toBe(201);
    residentIds.push(other.body.id);
    const res = await asAdmin(
      request(server()).patch(`${BASE}/residents/${other.body.id}/admissions/${admissionIds[0]}`),
    ).send({ exitDate: '2022-10-01' });
    expect(res.status).toBe(404);
  });
});
