import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('Public events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM event_registrations');
    await dataSource.query('DELETE FROM events');
    await app.close();
  });

  async function createEvent(body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(201);
    return res.body.id;
  }

  const future = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString();

  const validReg = () => ({ name: 'Maria', contact: '11999990000' });

  // ── Public list / detail ──────────────────────────────────────────────────────

  it('GET /public/events lists future events without internal fields', async () => {
    await createEvent({ title: 'Público Futuro', description: 'd', startAt: future(30) });

    const res = await request(app.getHttpServer())
      .get(`${BASE}/public/events`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const item = res.body[0];
    expect(item).toHaveProperty('spotsLeft');
    expect(item).toHaveProperty('registrationOpen');
    expect(item).not.toHaveProperty('bannerKey');
  });

  it('GET /public/events/:id returns a public view with registration status', async () => {
    const id = await createEvent({
      title: 'Detalhe',
      description: 'd',
      startAt: future(20),
      capacity: 10,
    });

    const res = await request(app.getHttpServer())
      .get(`${BASE}/public/events/${id}`)
      .expect(200);

    expect(res.body.id).toBe(id);
    expect(res.body.capacity).toBe(10);
    expect(res.body.spotsLeft).toBe(10);
    expect(res.body.registrationOpen).toBe(true);
  });

  // ── Register ──────────────────────────────────────────────────────────────────

  it('POST /public/events/:id/register registers a person', async () => {
    const id = await createEvent({ title: 'Inscrição', description: 'd', startAt: future(15) });

    const res = await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send(validReg())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.eventId).toBe(id);
    expect(res.body.name).toBe('Maria');
  });

  it('400 when registering with an invalid body', async () => {
    const id = await createEvent({ title: 'Inválido', description: 'd', startAt: future(15) });
    await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send({ name: '', contact: '' })
      .expect(400);
  });

  it('409 when the event is sold out (capacity reached)', async () => {
    const id = await createEvent({
      title: 'Esgotado',
      description: 'd',
      startAt: future(10),
      capacity: 1,
    });

    await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send(validReg())
      .expect(201);

    await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send({ name: 'João', contact: '11988887777' })
      .expect(409);

    // E a vaga aparece esgotada na visão pública.
    const view = await request(app.getHttpServer())
      .get(`${BASE}/public/events/${id}`)
      .expect(200);
    expect(view.body.spotsLeft).toBe(0);
    expect(view.body.registrationOpen).toBe(false);
  });

  it('400 when registration window is closed', async () => {
    const id = await createEvent({
      title: 'Janela fechada',
      description: 'd',
      startAt: future(40),
      registrationOpensAt: future(20),
      registrationClosesAt: future(30),
    });
    // Agora (< opensAt) → ainda não abriu.
    await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send(validReg())
      .expect(400);
  });

  // ── Admin registrations list ────────────────────────────────────────────────────

  it('GET /events/:id/registrations lists registrants (ADMIN)', async () => {
    const id = await createEvent({ title: 'Com inscritos', description: 'd', startAt: future(12) });
    await request(app.getHttpServer())
      .post(`${BASE}/public/events/${id}/register`)
      .send(validReg())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`${BASE}/events/${id}/registrations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Maria');
    expect(res.body[0].contact).toBe('11999990000');
  });

  it('GET /events/:id/registrations → 401 without token', () =>
    request(app.getHttpServer())
      .get(`${BASE}/events/00000000-0000-0000-0000-000000000000/registrations`)
      .expect(401));
});
