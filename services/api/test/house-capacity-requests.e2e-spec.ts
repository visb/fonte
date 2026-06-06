import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('HouseCapacityRequestController (e2e)', () => {
  let app: INestApplication;
  let coordToken: string;
  let adminToken: string;
  let houseId: string;
  let secondRequestId: string;

  const getHouse = () =>
    request(app.getHttpServer())
      .get(`${BASE}/houses/${houseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('coordinator creates a request without changing the house capacity', async () => {
    const created = await request(app.getHttpServer())
      .post(`${BASE}/houses/${houseId}/capacity-requests`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ generalCapacity: 11, staffCapacity: 6 })
      .expect(201);

    expect(created.body.status).toBe('PENDING');

    const house = await getHouse();
    // Capacidade da casa NÃO muda enquanto pendente.
    expect(house.body.generalCapacity).not.toBe(11);
  });

  it('a new request supersedes the previous pending one', async () => {
    const created = await request(app.getHttpServer())
      .post(`${BASE}/houses/${houseId}/capacity-requests`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ generalCapacity: 12, staffCapacity: 7 })
      .expect(201);
    secondRequestId = created.body.id;

    const list = await request(app.getHttpServer())
      .get(`${BASE}/houses/${houseId}/capacity-requests`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pending = list.body.filter((r: { status: string }) => r.status === 'PENDING');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(secondRequestId);
    expect(
      list.body.some((r: { status: string }) => r.status === 'SUPERSEDED'),
    ).toBe(true);
  });

  it('coordinator cannot list the history (admin-only)', () =>
    request(app.getHttpServer())
      .get(`${BASE}/houses/${houseId}/capacity-requests`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));

  it('coordinator cannot approve a request (admin-only)', () =>
    request(app.getHttpServer())
      .patch(`${BASE}/house-capacity-requests/${secondRequestId}/approve`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));

  it('admin approves and the house capacity is applied', async () => {
    await request(app.getHttpServer())
      .patch(`${BASE}/house-capacity-requests/${secondRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const house = await getHouse();
    expect(house.body.generalCapacity).toBe(12);
    expect(house.body.staffCapacity).toBe(7);
  });

  it('approving an already-resolved request returns 409', () =>
    request(app.getHttpServer())
      .patch(`${BASE}/house-capacity-requests/${secondRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409));

  it('admin reads the single request reflecting the resolved status', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/house-capacity-requests/${secondRequestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('coordinator cannot read a single request (admin-only)', () =>
    request(app.getHttpServer())
      .get(`${BASE}/house-capacity-requests/${secondRequestId}`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403));
});
