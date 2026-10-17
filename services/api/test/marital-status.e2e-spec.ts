import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MaritalStatus, Role } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 210 — estado civil ganha "União estável" (STABLE_UNION) e "Viúvo(a)"
 * (WIDOWED) para filhos e servos. Fixtures próprias, criadas via API e
 * removidas por id no `afterAll` (story 182).
 */
describe('Estado civil: união estável e viúvo(a) (e2e, story 210)', () => {
  let app: INestApplication;
  let adminToken: string;
  let houseId: string;
  const residentIds: string[] = [];
  const staffIds: string[] = [];
  const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ houseId } = await loginCoordinator(app));
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

  const createResident = async (maritalStatus?: unknown) => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Estado Civil Filho ${stamp()}`, houseId, maritalStatus });
    if (res.status === 201) residentIds.push(res.body.id);
    return res;
  };

  const createStaff = async (maritalStatus?: unknown) => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Estado Civil Servo ${stamp()}`,
        password: 'secret123',
        role: Role.SERVANT,
        maritalStatus,
      });
    if (res.status === 201) staffIds.push(res.body.id);
    return res;
  };

  describe('filho', () => {
    it('POST /residents com STABLE_UNION → 201 e persistido', async () => {
      const created = await createResident(MaritalStatus.STABLE_UNION);
      expect(created.status).toBe(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.maritalStatus).toBe(MaritalStatus.STABLE_UNION);
    });

    it('PATCH /residents/:id para WIDOWED → 200 e persistido', async () => {
      const created = await createResident(MaritalStatus.SINGLE);
      expect(created.status).toBe(201);

      const patch = await request(app.getHttpServer())
        .patch(`${BASE}/residents/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maritalStatus: MaritalStatus.WIDOWED });
      expect(patch.status).toBe(200);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.maritalStatus).toBe(MaritalStatus.WIDOWED);
    });

    it('valor fora do enum → 400', async () => {
      const res = await createResident('SEPARATED');
      expect(res.status).toBe(400);
    });
  });

  describe('servo', () => {
    it('POST /staff com WIDOWED → 201 e persistido', async () => {
      const created = await createStaff(MaritalStatus.WIDOWED);
      expect(created.status).toBe(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/staff/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.maritalStatus).toBe(MaritalStatus.WIDOWED);
    });

    it('PATCH /staff/:id para STABLE_UNION → 200', async () => {
      const created = await createStaff();
      expect(created.status).toBe(201);

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maritalStatus: MaritalStatus.STABLE_UNION });
      expect(res.status).toBe(200);
      expect(res.body.maritalStatus).toBe(MaritalStatus.STABLE_UNION);
    });

    it('valor fora do enum → 400', async () => {
      const res = await createStaff('SEPARATED');
      expect(res.status).toBe(400);
    });
  });
});
