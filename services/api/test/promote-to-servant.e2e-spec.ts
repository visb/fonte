import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { Role, ServantRank } from '@fonte/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const STAMP = Date.now();

describe('Promote Resident to Servant (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let coordToken: string;
  let houseId: string;

  const residentIds: string[] = [];
  const emails: string[] = [];

  async function createResident(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ name, houseId })
      .expect(201);
    residentIds.push(res.body.id);
    return res.body.id;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ email: 'coord@fonte.com', password: 'coord123' })
      .expect(200);
    coordToken = loginRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    houseId = meRes.body.houseId;
  });

  afterAll(async () => {
    // Raw cleanup (bypass soft-delete) to leave the test DB pristine.
    if (residentIds.length) {
      const ids = residentIds;
      await dataSource.query('DELETE FROM staff WHERE former_resident_id = ANY($1)', [ids]);
      await dataSource.query('DELETE FROM resident_follow_ups WHERE resident_id = ANY($1)', [ids]);
      await dataSource.query('DELETE FROM residents WHERE id = ANY($1)', [ids]);
    }
    if (emails.length) {
      await dataSource.query('DELETE FROM staff WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))', [emails]);
      await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
    }
    await app.close();
  });

  // ── Auth / validation ─────────────────────────────────────────────────────────

  it('POST /residents/:id/promote-to-servant → 401 without token', async () => {
    const id = await createResident(`Sem Token ${STAMP}`);
    return request(app.getHttpServer())
      .post(`${BASE}/residents/${id}/promote-to-servant`)
      .send({})
      .expect(401);
  });

  it('→ 400 when resident has no access and email/password are missing', async () => {
    const id = await createResident(`Sem Acesso ${STAMP}`);
    return request(app.getHttpServer())
      .post(`${BASE}/residents/${id}/promote-to-servant`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ rank: ServantRank.ASPIRANTE })
      .expect(400);
  });

  // ── Happy path: resident without prior access ─────────────────────────────────

  describe('promoting a filho without prior access', () => {
    let residentId: string;
    let staffId: string;
    const email = `servo_novo_${STAMP}@fonte.org`;

    beforeAll(async () => {
      residentId = await createResident(`Filho Promovido ${STAMP}`);
      emails.push(email);
    });

    it('creates a SERVANT staff as ASPIRANTE linked to the resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/promote-to-servant`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ email, password: 'senha123' })
        .expect(201);

      staffId = res.body.id;
      expect(res.body.rank).toBe(ServantRank.ASPIRANTE);
      expect(res.body.formerResidentId).toBe(residentId);
      expect(res.body.houseId).toBe(houseId);
      expect(res.body.user.role).toBe(Role.SERVANT);
      expect(res.body.user.email).toBe(email);
    });

    it('archives the filho as DISCHARGED with an exit date', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(res.body.status).toBe('DISCHARGED');
      expect(res.body.exitDate).toBeTruthy();
    });

    it('logs a PROMOTED_TO_SERVANT follow-up on the timeline', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/follow-ups`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(res.body.some((f: { type: string }) => f.type === 'PROMOTED_TO_SERVANT')).toBe(true);
    });

    it('rejects a second promotion of the same filho with 409', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/promote-to-servant`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ email: `dup_${STAMP}@fonte.org`, password: 'senha123' })
        .expect(409);

      // staff still exists and is unique
      const staffRes = await request(app.getHttpServer())
        .get(`${BASE}/staff/${staffId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(staffRes.body.id).toBe(staffId);
    });
  });

  // ── Reuse of the kiosk User ───────────────────────────────────────────────────

  describe('promoting a filho that already has kiosk access', () => {
    let residentId: string;
    const email = `servo_reuse_${STAMP}@fonte.org`;

    beforeAll(async () => {
      residentId = await createResident(`Filho Com Acesso ${STAMP}`);
      emails.push(email);
      await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/access`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ email, password: 'senha123' })
        .expect(201);
    });

    it('reuses the existing User and switches its role to SERVANT', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/promote-to-servant`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ rank: ServantRank.CONSAGRADO })
        .expect(201);

      expect(res.body.user.email).toBe(email);
      expect(res.body.user.role).toBe(Role.SERVANT);
      expect(res.body.rank).toBe(ServantRank.CONSAGRADO);

      // Same user row, role flipped from RESIDENT to SERVANT.
      const rows = await dataSource.query('SELECT role FROM users WHERE email = $1', [email]);
      expect(rows[0].role).toBe('SERVANT');
    });
  });
});
