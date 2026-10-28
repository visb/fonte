import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { IncidentSeverity } from '@fonte/types';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { loginCoordinator, BASE } from './helpers/e2e-app';

describe('IncidentController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let houseId: string;
  let responsibleId: string;
  // Filhos do seed: só LIDOS. A junção criada aqui some em cascata com a
  // ocorrência (limpeza por id da fixture — story 182).
  let houseResidentIds: string[];
  let otherHouseResidentId: string;
  const createdIncidentIds: string[] = [];
  const description = (label: string) => `[e2e-227] ${label} ${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    ({ token, houseId } = await loginCoordinator(app));

    // Coordinator's own staff id serves as the incident responsible.
    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    responsibleId = me.body.id;

    const sameHouse = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM residents WHERE house_id = $1 AND deleted_at IS NULL ORDER BY name LIMIT 2`,
      [houseId],
    );
    houseResidentIds = sameHouse.map((r) => r.id);
    const [other] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM residents WHERE house_id IS NOT NULL AND house_id <> $1 AND deleted_at IS NULL LIMIT 1`,
      [houseId],
    );
    otherHouseResidentId = other?.id;
  });

  afterAll(async () => {
    if (createdIncidentIds.length) {
      await dataSource.query('DELETE FROM incidents WHERE id = ANY($1)', [createdIncidentIds]);
    }
    await app.close();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`${BASE}/incidents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-01', severity: IncidentSeverity.LOW, houseId, responsibleId, ...body });

  const track = (res: request.Response) => {
    if (res.body?.id) createdIncidentIds.push(res.body.id);
    return res;
  };

  describe('authentication', () => {
    it('GET /incidents → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/incidents`).expect(401));
  });

  describe('validation', () => {
    it('POST /incidents → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400));

    it('POST /incidents → 400 for an invalid severity', () =>
      post({ severity: 'NONSENSE', description: 'x' }).expect(400));

    it('POST /incidents → 400 for non-UUID or duplicated residentIds', async () => {
      await post({ description: 'x', residentIds: ['nope'] }).expect(400);
      await post({ description: 'x', residentIds: [houseResidentIds[0], houseResidentIds[0]] }).expect(400);
    });

    it('POST /incidents → 400 for a resident from another house', async () => {
      const res = await post({
        description: description('outra casa'),
        residentIds: [houseResidentIds[0], otherHouseResidentId],
      });
      track(res);
      expect(res.status).toBe(400);
    });
  });

  describe('create & list', () => {
    let incidentId: string;
    let multiId: string;

    it('creates an incident without residents (house incident)', async () => {
      const res = track(await post({ description: description('da casa') }).expect(201));
      expect(res.body.id).toBeDefined();
      expect(res.body.residents).toEqual([]);
      incidentId = res.body.id;
    });

    it('creates an incident with N residents (residentIds)', async () => {
      expect(houseResidentIds).toHaveLength(2);
      const res = track(
        await post({ description: description('briga'), residentIds: houseResidentIds }).expect(201),
      );
      expect(res.body.residents.map((r: { id: string }) => r.id)).toEqual(houseResidentIds);
      expect(Object.keys(res.body.residents[0]).sort()).toEqual(['id', 'name']);
      multiId = res.body.id;
    });

    // Payload antigo da fila offline / APK em campo: tem que continuar passando
    // pelo ValidationPipe com forbidNonWhitelisted.
    it('still accepts the legacy residentId (union with residentIds, no duplicate)', async () => {
      const legacy = track(
        await post({ description: description('legado'), residentId: houseResidentIds[0] }).expect(201),
      );
      expect(legacy.body.residents.map((r: { id: string }) => r.id)).toEqual([houseResidentIds[0]]);

      const both = track(
        await post({
          description: description('legado+array'),
          residentIds: houseResidentIds,
          residentId: houseResidentIds[1],
        }).expect(201),
      );
      expect(both.body.residents).toHaveLength(2);
    });

    it('lists incidents', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/incidents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET ?residentId= filters by resident and returns every involved resident', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/incidents`)
        .query({ houseId, residentId: houseResidentIds[1] })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const ids = res.body.map((i: { id: string }) => i.id);
      expect(ids).toContain(multiId);
      expect(ids).not.toContain(incidentId);
      const multi = res.body.find((i: { id: string }) => i.id === multiId);
      expect(multi.residents.map((r: { id: string }) => r.id).sort()).toEqual([...houseResidentIds].sort());
    });

    it('fetches a single incident with its residents', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/incidents/${multiId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.residents).toHaveLength(2);
      expect(res.body.responsible.id).toBe(responsibleId);
    });

    it('GET /incidents/:id → 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/incidents/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));

    it('exposes no DELETE route (incidents are immutable)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`${BASE}/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404); // route does not exist
    });
  });
});
