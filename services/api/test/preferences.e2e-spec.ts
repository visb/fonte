import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('Preferences (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    // Dois usuários distintos para provar o isolamento por token (decisão 3).
    tokenA = await login(app, 'admin@fonte.com', 'admin123');
    tokenB = await login(app, 'coord@fonte.com', 'coord123');
  });

  afterAll(async () => {
    await app.close();
  });

  const KEY = 'residents.filters';

  afterEach(async () => {
    // Limpa a chave usada nos dois usuários (idempotente).
    await request(app.getHttpServer())
      .delete(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`);
    await request(app.getHttpServer())
      .delete(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenB}`);
  });

  it('ciclo PUT → GET → DELETE → GET (some)', async () => {
    const value = { status: '', house: 'h1', overdue: true, sort: 'name_asc' };

    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value })
      .expect(200);

    const afterPut = await request(app.getHttpServer())
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterPut.body[KEY]).toEqual(value);

    await request(app.getHttpServer())
      .delete(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterDelete.body[KEY]).toBeUndefined();
  });

  it('PUT é upsert idempotente — segunda gravação atualiza sem duplicar', async () => {
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: { status: 'ACTIVE' } })
      .expect(200);
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: { status: '' } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body[KEY]).toEqual({ status: '' });
  });

  it('DELETE de chave inexistente é idempotente (204)', async () => {
    await request(app.getHttpServer())
      .delete(`${BASE}/preferences/some.other`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });

  it('401 sem token', async () => {
    await request(app.getHttpServer()).get(`${BASE}/preferences`).expect(401);
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .send({ value: { status: '' } })
      .expect(401);
  });

  it('isolamento: A não lê nem escreve a preferência de B', async () => {
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ value: { status: 'DISCIPLINE' } })
      .expect(200);

    // A não enxerga a preferência de B.
    const aView = await request(app.getHttpServer())
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(aView.body[KEY]).toBeUndefined();

    // A grava a própria chave — não sobrescreve a de B.
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: { status: 'ACTIVE' } })
      .expect(200);

    const bView = await request(app.getHttpServer())
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(bView.body[KEY]).toEqual({ status: 'DISCIPLINE' });
  });

  it('400 para chave fora do formato (path traversal)', async () => {
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${encodeURIComponent('../../etc')}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: { x: 1 } })
      .expect(400);
  });

  it('400 quando value ultrapassa 4 KB', async () => {
    await request(app.getHttpServer())
      .put(`${BASE}/preferences/${KEY}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: { blob: 'x'.repeat(4097) } })
      .expect(400);
  });
});
