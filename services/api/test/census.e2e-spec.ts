import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

const today = () => new Date().toISOString().split('T')[0];

describe('CensusController (e2e)', () => {
  let app: INestApplication;
  let coordToken: string;
  let adminToken: string;
  let houseId: string;
  let residentA: string;
  let residentB: string;

  const addResident = (name: string) =>
    request(app.getHttpServer())
      .post(`${BASE}/census/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ name, houseId, entryDate: today() });

  const getStatus = async (id: string) => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return res.body.status as string;
  };

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('coordinator adds residents as CENSUS_ADDED', async () => {
    const a = await addResident('Census A').expect(201);
    const b = await addResident('Census B').expect(201);
    residentA = a.body.id;
    residentB = b.body.id;
    expect(a.body.status).toBe('CENSUS_ADDED');
    expect(b.body.status).toBe('CENSUS_ADDED');
  });

  it('admin lists the pending residents', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/census/houses/${houseId}/pending`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = res.body.map((r: { id: string }) => r.id);
    expect(ids).toEqual(expect.arrayContaining([residentA, residentB]));
  });

  it('coordinator concludes the census reporting the added count', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/census/conclude`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ houseId, confirmedCount: 5, total: 5 })
      .expect(201);
    expect(res.body.addedCount).toBeGreaterThanOrEqual(2);
  });

  it('coordinator cannot list pending (admin-only)', () =>
    request(app.getHttpServer())
      .get(`${BASE}/census/houses/${houseId}/pending`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));

  it('admin rejects one resident (→ REJECTED_CENSUS)', async () => {
    await request(app.getHttpServer())
      .patch(`${BASE}/census/residents/${residentA}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(await getStatus(residentA)).toBe('REJECTED_CENSUS');
  });

  it('admin approves all remaining (→ ACTIVE)', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/census/houses/${houseId}/approve-all`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(await getStatus(residentB)).toBe('ACTIVE');
  });

  it('coordinator cannot approve all (admin-only)', () =>
    request(app.getHttpServer())
      .post(`${BASE}/census/houses/${houseId}/approve-all`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));
});
