import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 197 — o vínculo filho↔ministério não existe mais.
 *
 * Fixtures conforme a story 182: o ministério usado aqui é criado por este
 * arquivo (nome com `Date.now()`), removido no `afterAll` por id acumulado, e
 * o seed é lido somente para leitura. Nenhum DELETE por categoria.
 */
describe('Ministries — vínculo com filho removido (e2e, story 197)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  let houseId: string;
  let ministryId: string;
  let residentId: string;
  const createdMinistryIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');

    const created = await request(app.getHttpServer())
      .post(`${BASE}/houses/${houseId}/ministries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Ministério 197 ${Date.now()}` })
      .expect(201);
    ministryId = created.body.id;
    createdMinistryIds.push(ministryId);

    // Só leitura: um filho qualquer do seed serve para provar que a ficha não
    // devolve mais ministério.
    const residents = await request(app.getHttpServer())
      .get(`${BASE}/residents`)
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    residentId = residents.body.data[0]?.id;
  });

  afterAll(async () => {
    for (const id of createdMinistryIds) {
      // Tolera 404: o ministério pode já ter sido removido por um teste.
      await request(app.getHttpServer())
        .delete(`${BASE}/ministries/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  // ── decisão 6: as rotas de membro sumiram, não foram esvaziadas ────────────

  it('POST /ministries/:id/residents → 404 (rota inexistente), para ADMIN inclusive', () =>
    request(app.getHttpServer())
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ residentId })
      .expect(404));

  it('DELETE /ministries/:id/residents/:residentId → 404 (rota inexistente)', () =>
    request(app.getHttpServer())
      .delete(`${BASE}/ministries/${ministryId}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404));

  it('a rota de membro também não existe para o coordenador', () =>
    request(app.getHttpServer())
      .post(`${BASE}/ministries/${ministryId}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ residentId })
      .expect(404));

  // ── o detalhe do ministério não devolve filhos ─────────────────────────────

  it('GET /ministries/:id → 200 sem a chave residents e só com membros servos', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/ministries/${ministryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).not.toHaveProperty('residents');
    expect(Array.isArray(res.body.members)).toBe(true);
    for (const m of res.body.members) expect(m.role).toBe('SERVO');
  });

  it('GET /houses/:id/ministries → contagem de servos, sem filhoCount', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/houses/${houseId}/ministries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const mine = res.body.find((m: { id: string }) => m.id === ministryId);
    expect(mine).toBeDefined();
    expect(mine).not.toHaveProperty('filhoCount');
    expect(mine.servoCount).toBe(0);
  });

  // ── decisão 3: só servo lidera ────────────────────────────────────────────

  it('PATCH /ministries/:id com leaderType RESIDENT → 400 e nada persistido', async () => {
    await request(app.getHttpServer())
      .patch(`${BASE}/ministries/${ministryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leaderId: residentId, leaderType: 'RESIDENT' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .get(`${BASE}/ministries/${ministryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.leaderId).toBeNull();
    expect(res.body.leaderType).toBeNull();
  });

  // ── a ficha do filho não fala mais em ministério ──────────────────────────

  it('GET /residents/:id → 200 sem ministry/ministryId', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).not.toHaveProperty('ministry');
    expect(res.body).not.toHaveProperty('ministryId');
  });

  it('GET /residents → nenhum item da lista traz ministério', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents`)
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    for (const r of res.body.data) {
      expect(r).not.toHaveProperty('ministry');
      expect(r).not.toHaveProperty('ministryId');
    }
  });

  it('PATCH /residents/:id com ministryId no corpo → 400 do ValidationPipe', () =>
    request(app.getHttpServer())
      .patch(`${BASE}/residents/${residentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ministryId })
      .expect(400));

  it('GET /residents/:id/admissions → nenhum acolhimento traz ministryId', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/admissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    for (const a of res.body) expect(a).not.toHaveProperty('ministryId');
  });
});
