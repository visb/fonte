import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Role } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('AuthController login (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let houseId: string;
  const createdStaffIds: string[] = [];

  // Telefone único, armazenado formatado para provar a normalização no login.
  const PHONE_STORED = '(11) 97777-0001';
  const PHONE_DIGITS = '11977770001';
  const STAFF_PASSWORD = 'phone1234';

  async function createStaff(phone: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Phone Login Test', password: STAFF_PASSWORD, role: Role.SERVANT, houseId, phone })
      .expect(201);
    createdStaffIds.push(res.body.id);
    return res.body.id;
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of createdStaffIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('logs in by e-mail (identifier with @)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'admin@fonte.com', password: 'admin123' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.profileType).toBe('STAFF');
  });

  it('logs in by phone, normalizing digits against the stored formatted value', async () => {
    await createStaff(PHONE_STORED);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: PHONE_DIGITS, password: STAFF_PASSWORD })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.profileType).toBe('STAFF');
  });

  it('rejects login by phone with a wrong password', () =>
    request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: PHONE_DIGITS, password: 'errada' })
      .expect(401));

  it('rejects an unknown phone', () =>
    request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: '11900000000', password: STAFF_PASSWORD })
      .expect(401));

  it('rejects an ambiguous phone matching more than one user', async () => {
    // Segundo staff com o mesmo telefone → ambíguo → recusa (não vaza ambiguidade).
    await createStaff(PHONE_STORED);
    await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: PHONE_DIGITS, password: STAFF_PASSWORD })
      .expect(401);
  });

  it('rejects an empty identifier with 400', () =>
    request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ identifier: '', password: 'whatever' })
      .expect(400));
});
