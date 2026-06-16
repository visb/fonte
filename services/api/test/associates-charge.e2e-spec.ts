import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { WHATSAPP_CLIENT } from '../src/modules/associate/whatsapp/whatsapp.types';

/**
 * E2E da cobrança manual (story 39). O cliente WhatsApp é MOCKADO via
 * overrideProvider — nenhuma chamada à Meta Cloud API é feita (não há
 * credencial no ambiente). Valida apenas authz (ADMIN ok / não-ADMIN 403) e o
 * dedupe de 5 dias no endpoint manual.
 */
describe('Associate manual charge (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  const sendTemplate = jest.fn().mockResolvedValue({ sent: true, messageId: 'wamid.mock' });

  beforeAll(async () => {
    app = await bootstrapApp({
      overrideProvider: { token: WHATSAPP_CLIENT, useValue: { sendTemplate } },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken } = await loginCoordinator(app));
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM associate_charge_notifications');
    await dataSource.query('DELETE FROM associates');
    await app.close();
  });

  beforeEach(() => sendTemplate.mockClear());

  async function createAssociate(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/associates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cobrança Manual',
        whatsapp: '+5562988887777',
        contributionAmount: 40,
        dueDay: 5,
      })
      .expect(201);
    return res.body.id;
  }

  it('403 for non-ADMIN (coordinator)', async () => {
    const id = await createAssociate();
    await request(app.getHttpServer())
      .post(`${BASE}/associates/${id}/charge`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(403);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('401 without token', async () => {
    const id = await createAssociate();
    await request(app.getHttpServer())
      .post(`${BASE}/associates/${id}/charge`)
      .expect(401);
  });

  it('ADMIN can charge a PENDING associate, then dedupe blocks the next call', async () => {
    const id = await createAssociate();

    const first = await request(app.getHttpServer())
      .post(`${BASE}/associates/${id}/charge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(first.body).toEqual({ sent: true, skipped: false });
    expect(sendTemplate).toHaveBeenCalledTimes(1);

    // Second call within the 5-day window is deduped (no send).
    const second = await request(app.getHttpServer())
      .post(`${BASE}/associates/${id}/charge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(second.body).toEqual({ sent: false, skipped: true });
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });

  it('skips an unknown associate', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/associates/00000000-0000-0000-0000-000000000000/charge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({ sent: false, skipped: true });
  });
});
