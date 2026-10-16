import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { maxBirthDateFor, MIN_AGE_MESSAGE, Role, todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 202 — filho e servo só com 18 anos completos hoje. Fixtures próprias,
 * criadas via API e removidas por id no `afterAll` (story 182). A ficha
 * "legada" com nascimento de menor é forjada por UPDATE direto na linha que a
 * própria suíte criou — é o único jeito de reproduzir o dado antigo, já que a
 * API passou a recusá-lo.
 */
describe('Nascimento só de maiores de 18 (e2e, story 202)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let houseId: string;
  const residentIds: string[] = [];
  const staffIds: string[] = [];

  // Datas fixas antigas para o adulto (não envelhecem para menor) e relativas a
  // hoje para o menor (sempre 17 anos).
  const ADULT = '1970-04-15';
  const today = todayInSaoPaulo();
  const exactly18 = maxBirthDateFor(today);
  const minor = `${Number(exactly18.slice(0, 4)) + 1}${exactly18.slice(4)}`.replace('-02-29', '-02-28');
  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of residentIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    for (const id of staffIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  const createResident = async (birthDate?: string) => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Maioridade Filho ${stamp()}`, houseId, ...(birthDate ? { birthDate } : {}) });
    if (res.status === 201) residentIds.push(res.body.id);
    return res;
  };

  const createStaff = async (birthDate?: string) => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Maioridade Servo ${stamp()}`,
        password: 'secret123',
        role: Role.SERVANT,
        ...(birthDate ? { birthDate } : {}),
      });
    if (res.status === 201) staffIds.push(res.body.id);
    return res;
  };

  describe('filho', () => {
    it('POST /residents com 17 anos → 400 com a mensagem', async () => {
      const res = await createResident(minor);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MIN_AGE_MESSAGE);
    });

    it('POST /residents com 18 anos completos hoje → 201', async () => {
      const res = await createResident(exactly18);
      expect(res.status).toBe(201);
    });

    it('POST /census/residents (contagem do ops) com 17 anos → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/census/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: `Maioridade Contagem ${stamp()}`, houseId, entryDate: today, birthDate: minor });
      if (res.status === 201) residentIds.push(res.body.id);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MIN_AGE_MESSAGE);
    });

    it('PATCH /residents/:id mudando para menor → 400; identity idem', async () => {
      const created = await createResident(ADULT);
      expect(created.status).toBe(201);
      const id = created.body.id;

      const patch = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ birthDate: minor });
      expect(patch.status).toBe(400);
      expect(patch.body.message).toBe(MIN_AGE_MESSAGE);

      const identity = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${id}/identity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ birthDate: minor });
      expect(identity.status).toBe(400);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(String(after.body.birthDate).slice(0, 10)).toBe(ADULT);
    });

    it('PATCH sem mexer na data de uma ficha legada de menor → 200', async () => {
      const created = await createResident(ADULT);
      const id = created.body.id;
      await dataSource.query('UPDATE residents SET birth_date = $1 WHERE id = $2', [minor, id]);

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ occupation: 'Pedreiro', birthDate: minor });
      expect(res.status).toBe(200);
      expect(res.body.occupation).toBe('Pedreiro');
    });

    it('POST /residents/import/commit com ficha de menor → 400, nada criado', async () => {
      const name = `Maioridade Import ${stamp()}`;
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident: { name, houseId, birthDate: minor, entryDate: '2023-01-10' },
          relatives: [],
          contributionMonths: [],
          photoBase64: null,
        });
      if (res.status === 201) residentIds.push(res.body.resident.id);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MIN_AGE_MESSAGE);

      const rows = await dataSource.query('SELECT id FROM residents WHERE name = $1', [name]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('servo', () => {
    it('POST /staff com 17 anos → 400 com a mensagem', async () => {
      const res = await createStaff(minor);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MIN_AGE_MESSAGE);
    });

    it('POST /staff com adulto → 201', async () => {
      const res = await createStaff(ADULT);
      expect(res.status).toBe(201);
    });

    it('PATCH /staff/:id mudando para menor → 400', async () => {
      const created = await createStaff(ADULT);
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ birthDate: minor });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MIN_AGE_MESSAGE);
    });

    it('PATCH sem mexer na data de um servo legado menor → 200', async () => {
      const created = await createStaff(ADULT);
      const id = created.body.id;
      await dataSource.query('UPDATE staff SET birth_date = $1 WHERE id = $2', [minor, id]);

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Servo Legado ${stamp()}` });
      expect(res.status).toBe(200);
    });
  });
});
