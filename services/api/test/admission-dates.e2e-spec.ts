import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ADMISSION_DATE_MESSAGES, ResidentStatus, todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 203 — coerência das datas de entrada e saída. Fixtures próprias,
 * criadas via API e removidas por id no `afterAll` (story 182). Datas fixas no
 * passado (não envelhecem) e "amanhã" relativo ao dia de São Paulo.
 */
describe('Datas de entrada e saída (e2e, story 203)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let houseId: string;
  const residentIds: string[] = [];

  const today = todayInSaoPaulo();
  const tomorrow = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of residentIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  const createResident = async (dates: { entryDate?: string; exitDate?: string }) => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Datas Filho ${stamp()}`, houseId, status: ResidentStatus.ACTIVE, ...dates });
    if (res.status === 201) residentIds.push(res.body.id);
    return res;
  };

  const patch = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`${BASE}/residents/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

  it('POST /residents com entrada futura → 400 com a mensagem', async () => {
    const res = await createResident({ entryDate: tomorrow });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ADMISSION_DATE_MESSAGES.entryFuture);
  });

  it('POST /residents com entrada hoje → 201', async () => {
    const res = await createResident({ entryDate: today });
    expect(res.status).toBe(201);
  });

  it('PATCH de alta com saída antes da entrada → 400, nada muda', async () => {
    const created = await createResident({ entryDate: '2025-01-10' });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const res = await patch(id, { status: ResidentStatus.DISCHARGED, exitDate: '2025-01-09' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2025-01-10'));

    const future = await patch(id, { status: ResidentStatus.EVADED, exitDate: tomorrow });
    expect(future.status).toBe(400);
    expect(future.body.message).toBe(ADMISSION_DATE_MESSAGES.exitFuture);

    const after = await request(app.getHttpServer())
      .get(`${BASE}/residents/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(after.body.status).toBe(ResidentStatus.ACTIVE);
    expect(after.body.exitDate).toBeNull();
  });

  it('alta no mesmo dia da entrada → 200; reenvio idempotente → 200', async () => {
    const created = await createResident({ entryDate: '2025-02-01' });
    const id = created.body.id;
    const body = { status: ResidentStatus.EVADED, exitDate: '2025-02-01' };

    expect((await patch(id, body)).status).toBe(200);
    expect((await patch(id, body)).status).toBe(200);
  });

  it('ficha legada incoerente + PATCH sem datas → 200', async () => {
    const created = await createResident({ entryDate: '2025-03-01' });
    const id = created.body.id;
    await dataSource.query('UPDATE residents SET exit_date = $1 WHERE id = $2', ['2025-02-01', id]);

    const res = await patch(id, { occupation: 'Pedreiro' });
    expect(res.status).toBe(200);
  });

  it('readmissão antes da última saída → 400; na data da saída → 201', async () => {
    const created = await createResident({ entryDate: '2025-04-01' });
    const id = created.body.id;
    expect(
      (await patch(id, { status: ResidentStatus.DISCHARGED, exitDate: '2025-09-15' })).status,
    ).toBe(200);

    const readmit = (entryDate: string) =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${id}/readmit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ houseId, entryDate });

    const before = await readmit('2025-09-14');
    expect(before.status).toBe(400);
    expect(before.body.message).toBe(
      ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2025-09-15'),
    );

    const future = await readmit(tomorrow);
    expect(future.status).toBe(400);
    expect(future.body.message).toBe(ADMISSION_DATE_MESSAGES.entryFuture);

    const ok = await readmit('2025-09-15');
    expect(ok.status).toBe(201);
  });

  it('POST /residents/import/commit com passagem de saída < entrada → 400, nada criado', async () => {
    const name = `Datas Import ${stamp()}`;
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents/import/commit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        resident: {
          name,
          houseId,
          entryDate: '2023-01-10',
          exitDate: '2023-08-01',
          admissions: [
            { entryDate: '2020-05-10', exitDate: '2020-05-01' },
            { entryDate: '2023-01-10', exitDate: '2023-08-01' },
          ],
        },
        relatives: [],
        contributionMonths: [],
        photoBase64: null,
      });
    if (res.status === 201) residentIds.push(res.body.resident.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2020-05-10'));

    const rows = await dataSource.query('SELECT id FROM residents WHERE name = $1', [name]);
    expect(rows).toHaveLength(0);
  });
});
