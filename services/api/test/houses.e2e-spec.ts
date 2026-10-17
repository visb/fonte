import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('HouseController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let houseId: string;
  let adminToken: string;
  let dataSource: DataSource;
  const createdIds: string[] = [];
  const staffIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    ({ token, houseId } = await loginCoordinator(app));
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    // Story 182: limpeza por id acumulado da fixture. Servos antes das casas —
    // o delete tolera 404 (o desligamento pode já ter acontecido no teste).
    for (const id of staffIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    for (const id of createdIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('authentication', () => {
    it('GET /houses → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/houses`).expect(401));

    it('POST /houses → 401 without token', () =>
      request(app.getHttpServer()).post(`${BASE}/houses`).send({}).expect(401));
  });

  describe('validation', () => {
    it('POST /houses → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('POST /houses → 400 when state is not 2 chars', () =>
      request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', state: 'SAO' })
        .expect(400));
  });

  describe('list & detail', () => {
    it('GET /houses returns the seeded house with counts', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const seeded = res.body.find((h: { id: string }) => h.id === houseId);
      expect(seeded).toBeDefined();
      expect(seeded).toHaveProperty('activeResidentsCount');
      expect(seeded).toHaveProperty('staffCount');
      expect(seeded).toHaveProperty('thumbnailUrl');
    });

    // Story 190: os três campos agregados saíam de um payload cacheado no Redis.
    // Sem cache, cada request recalcula — o contrato tem de bater com o banco.
    it('GET /houses agrega os contadores exatamente como o banco (sem cache)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const seeded = res.body.find((h: { id: string }) => h.id === houseId);
      const [residents] = await dataSource.query(
        `SELECT COUNT(id)::int AS count FROM residents
         WHERE house_id = $1 AND status = ANY($2) AND deleted_at IS NULL`,
        [houseId, ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE']],
      );
      const [staff] = await dataSource.query(
        `SELECT COUNT(DISTINCT id)::int AS count FROM staff
         WHERE house_id = $1 AND deleted_at IS NULL`,
        [houseId],
      );

      expect(typeof seeded.activeResidentsCount).toBe('number');
      expect(typeof seeded.staffCount).toBe('number');
      expect(seeded.activeResidentsCount).toBe(residents.count);
      expect(seeded.staffCount).toBe(staff.count);
      // Sem foto o campo desce como null explícito, nunca undefined.
      expect(seeded.thumbnailUrl === null || typeof seeded.thumbnailUrl === 'string').toBe(true);
    });

    // Casa recém-criada aparece na listagem no request seguinte com os agregados
    // zerados. Antes da 190 isso dependia da invalidação do cache house:list.
    it('GET /houses reflete uma casa nova imediatamente, com contadores zerados', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Casa Sem Cache ${Date.now()}`, generalCapacity: 4, state: 'SP' })
        .expect(201);
      createdIds.push(created.body.id);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const fresh = res.body.find((h: { id: string }) => h.id === created.body.id);
      expect(fresh).toBeDefined();
      expect(fresh).toMatchObject({
        activeResidentsCount: 0,
        staffCount: 0,
        thumbnailUrl: null,
      });
    });

    it('GET /houses/:id → 404 for an unknown house', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));

    it('GET /houses/:id → 400 for a non-uuid', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/not-a-uuid`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400));
  });

  describe('staff da casa (story 181)', () => {
    const PHOTO = '/uploads/staff/e2e-181.jpg';

    it('GET /houses/:id/staff devolve o resumo com photoUrl (null no seed, valor quando há foto)', async () => {
      const before = await request(app.getHttpServer())
        .get(`${BASE}/houses/${houseId}/staff`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(before.body.length).toBeGreaterThan(0);
      // O seed não sobe foto de servo: todos descem com `photoUrl` null — e só
      // com as colunas do resumo (minimização; a rota é lida por SERVANT). A
      // story 204 somou `role` e `ledMinistries`; a 207, `rank`.
      for (const s of before.body) {
        expect(Object.keys(s).sort()).toEqual([
          'id',
          'ledMinistries',
          'name',
          'photoUrl',
          'rank',
          'role',
          'whatsapp',
        ]);
        expect(s.photoUrl).toBeNull();
      }

      const target = before.body[0];
      await dataSource.query('UPDATE staff SET photo_url = $1 WHERE id = $2', [PHOTO, target.id]);
      try {
        const after = await request(app.getHttpServer())
          .get(`${BASE}/houses/${houseId}/staff`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const withPhoto = after.body.find((s: { id: string }) => s.id === target.id);
        expect(withPhoto).toMatchObject({
          id: target.id,
          name: target.name,
          whatsapp: target.whatsapp,
          photoUrl: PHOTO,
        });
      } finally {
        // Devolve o servo ao estado do seed — a suíte não pode deixar rastro.
        await dataSource.query('UPDATE staff SET photo_url = NULL WHERE id = $1', [target.id]);
      }
    });

    it('GET /houses/:id/staff → 404 para casa inexistente', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/00000000-0000-0000-0000-000000000000/staff`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404));
  });

  // ─── Lista de servos do ops (story 204) ───────────────────────────────────
  //
  // Fixtures próprias (story 182): casa, servos e ministérios criados por API e
  // removidos por id. O seed não é tocado.
  describe('papel e ministérios liderados (story 204)', () => {
    const stamp = Date.now();
    const ministryIds: string[] = [];
    let fixtureHouseId: string;
    let otherHouseId: string;
    let coordId: string;
    let servantId: string;
    let idleId: string;
    let dismissedId: string;
    let outsiderId: string;

    async function createHouse(name: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name })
        .expect(201);
      createdIds.push(res.body.id);
      return res.body.id;
    }

    async function createStaff(
      name: string,
      role: 'COORDINATOR' | 'SERVANT',
      house: string,
    ): Promise<{ id: string }> {
      const email = `${name.toLowerCase()}.${stamp}@fonte.test`;
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, email, password: 'secret123', role, houseId: house })
        .expect(201);
      staffIds.push(res.body.id);
      return { id: res.body.id };
    }

    async function createMinistry(name: string, leaderId: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses/${fixtureHouseId}/ministries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name })
        .expect(201);
      ministryIds.push(res.body.id);
      await request(app.getHttpServer())
        .patch(`${BASE}/ministries/${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ leaderId, leaderType: 'STAFF' })
        .expect(200);
      return res.body.id;
    }

    beforeAll(async () => {
      fixtureHouseId = await createHouse(`Casa 204 ${stamp}`);
      otherHouseId = await createHouse(`Casa 204 Vizinha ${stamp}`);
      coordId = (await createStaff('Coord204', 'COORDINATOR', fixtureHouseId)).id;
      servantId = (await createStaff('Servo204', 'SERVANT', fixtureHouseId)).id;
      idleId = (await createStaff('Ocioso204', 'SERVANT', fixtureHouseId)).id;
      dismissedId = (await createStaff('Desligado204', 'SERVANT', fixtureHouseId)).id;
      outsiderId = (await createStaff('Vizinho204', 'SERVANT', otherHouseId)).id;

      await createMinistry(`Horta 204 ${stamp}`, servantId);
      await createMinistry(`Cozinha 204 ${stamp}`, servantId);
      await createMinistry(`Limpeza 204 ${stamp}`, coordId);
      const removed = await createMinistry(`Removido 204 ${stamp}`, servantId);
      await request(app.getHttpServer())
        .delete(`${BASE}/ministries/${removed}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${dismissedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    afterAll(async () => {
      // Ministérios antes das casas; o delete tolera 404 (o removido já saiu).
      for (const id of ministryIds) {
        await request(app.getHttpServer())
          .delete(`${BASE}/ministries/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    // Servo criado por API nasce com troca de senha obrigatória (403 em tudo até
    // trocar) — o SERVANT do seed prova o acesso na própria casa, read-only.
    it('SERVANT → 200 com os campos novos na própria casa', async () => {
      const servantToken = await login(app, 'operator@fonte.com', 'operator123');
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses/${houseId}/staff`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(200);

      const operator = res.body.find((s: { name: string }) => s.name === 'Operador Teste');
      expect(operator).toMatchObject({ role: 'SERVANT' });
      expect(Array.isArray(operator.ledMinistries)).toBe(true);
      const coordinator = res.body.find((s: { name: string }) => s.name === 'Coordenador Teste');
      expect(coordinator).toMatchObject({ role: 'COORDINATOR' });
    });

    it('role e ledMinistries batem com o banco; excluídos e de outra casa ficam de fora', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses/${fixtureHouseId}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const byId = new Map(res.body.map((s: { id: string }) => [s.id, s]));
      expect([...byId.keys()].sort()).toEqual([coordId, servantId, idleId].sort());
      expect(byId.has(dismissedId)).toBe(false);
      expect(byId.has(outsiderId)).toBe(false);

      expect(byId.get(coordId)).toMatchObject({
        role: 'COORDINATOR',
        ledMinistries: [{ name: `Limpeza 204 ${stamp}` }],
      });
      // Ordenados por nome; o ministério excluído não aparece.
      expect(byId.get(servantId)).toMatchObject({
        role: 'SERVANT',
        ledMinistries: [{ name: `Cozinha 204 ${stamp}` }, { name: `Horta 204 ${stamp}` }],
      });
      expect(byId.get(idleId)).toMatchObject({ role: 'SERVANT', ledMinistries: [] });
      for (const m of (byId.get(servantId) as { ledMinistries: object[] }).ledMinistries) {
        expect(Object.keys(m).sort()).toEqual(['id', 'name']);
      }
    });

    it('RELATIVE → 403', async () => {
      const relativeToken = await login(app, 'familiar@fonte.com', 'familiar123');
      await request(app.getHttpServer())
        .get(`${BASE}/houses/${fixtureHouseId}/staff`)
        .set('Authorization', `Bearer ${relativeToken}`)
        .expect(403);
    });
  });

  // ─── Coordenadores da casa (story 194) ────────────────────────────────────
  //
  // Fixtures próprias (story 182): casa + staff criados por API e removidos por
  // id no afterAll. O seed é somente leitura — nenhum servo semeado muda de casa
  // ou de role aqui.
  describe('coordenadores da casa (story 194)', () => {
    const stamp = Date.now();
    let fixtureHouseId: string;
    let otherHouseId: string;
    let anaId: string;
    let brunoId: string;
    let servantId: string;
    let dismissedId: string;

    async function createStaff(
      name: string,
      role: 'COORDINATOR' | 'SERVANT',
      houseId: string,
    ): Promise<string> {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name,
          email: `${name.split(' ')[0].toLowerCase()}.${stamp}@fonte.test`,
          password: 'secret123',
          role,
          houseId,
        })
        .expect(201);
      staffIds.push(res.body.id);
      return res.body.id;
    }

    async function createHouse(name: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name })
        .expect(201);
      createdIds.push(res.body.id);
      return res.body.id;
    }

    function detail(authToken: string, id = fixtureHouseId) {
      return request(app.getHttpServer())
        .get(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    }

    beforeAll(async () => {
      fixtureHouseId = await createHouse(`Casa 194 ${stamp}`);
      otherHouseId = await createHouse(`Casa 194 Vizinha ${stamp}`);
      anaId = await createStaff('Ana194', 'COORDINATOR', fixtureHouseId);
      brunoId = await createStaff('Bruno194', 'COORDINATOR', fixtureHouseId);
      servantId = await createStaff('Servo194', 'SERVANT', fixtureHouseId);
      // Coordenador desligado: entra na casa e sai, para provar que some da lista.
      dismissedId = await createStaff('Desligado194', 'COORDINATOR', fixtureHouseId);
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${dismissedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('GET /houses/:id devolve os coordenadores da casa para ADMIN e COORDINATOR', async () => {
      for (const authToken of [adminToken, token]) {
        const res = await detail(authToken);
        expect(Array.isArray(res.body.coordinators)).toBe(true);
        expect(res.body.coordinators.map((c: { id: string }) => c.id)).toEqual([anaId, brunoId]);
        // Servo da casa e coordenador desligado ficam de fora.
        const ids = res.body.coordinators.map((c: { id: string }) => c.id);
        expect(ids).not.toContain(servantId);
        expect(ids).not.toContain(dismissedId);
        // Só as colunas do resumo (minimização — a rota é lida por SERVANT).
        expect(Object.keys(res.body.coordinators[0]).sort()).toEqual([
          'id',
          'name',
          'photoUrl',
          'whatsapp',
        ]);
      }
    });

    it('casa sem coordenador nenhum devolve lista vazia, não undefined', async () => {
      const res = await detail(adminToken, otherHouseId);
      expect(res.body.coordinators).toEqual([]);
    });

    it('GET /houses não popula coordinators (decisão 10)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const fixture = res.body.find((h: { id: string }) => h.id === fixtureHouseId);
      expect(fixture.coordinators).toBeUndefined();
    });

    it('POST /houses com coordinatorId → 400 (decisão 8)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Casa 194 Recusada ${stamp}`, coordinatorId: anaId })
        .expect(400);
      expect(res.body.message).toContain('depois de cadastrar a casa');
    });

    it('PATCH /houses/:id recusa titular inelegível com 400 (decisão 7)', async () => {
      const coordOfAnotherHouse = await createStaff('Vizinho194', 'COORDINATOR', otherHouseId);

      for (const staffId of [servantId, coordOfAnotherHouse, dismissedId]) {
        const res = await request(app.getHttpServer())
          .patch(`${BASE}/houses/${fixtureHouseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ coordinatorId: staffId })
          .expect(400);
        expect(res.body.message).toBe(
          'O coordenador titular precisa ser um coordenador lotado nesta casa.',
        );
      }

      const after = await detail(adminToken);
      expect(after.body.coordinatorId).toBeNull();
    });

    it('PATCH /houses/:id aceita um coordenador da casa e o detalhe reflete o titular', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: brunoId })
        .expect(200);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBe(brunoId);
      expect(res.body.coordinator.id).toBe(brunoId);
      // O titular continua dentro da lista derivada.
      expect(res.body.coordinators.map((c: { id: string }) => c.id)).toContain(brunoId);
    });

    it('PATCH /houses/:id com coordinatorId null limpa o titular', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: null })
        .expect(200);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBeNull();
    });

    // Decisão 6 por HTTP: o titular muda de casa e a coluna NÃO pode continuar
    // apontando para ele — `ON DELETE SET NULL` não cobre soft delete nem troca
    // de lotação.
    it('titular que muda de casa deixa a casa sem titular, e o outro coordenador segue na lista', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: anaId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${BASE}/staff/${anaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ houseId: otherHouseId })
        .expect(200);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBeNull();
      expect(res.body.coordinator).toBeNull();
      const ids = res.body.coordinators.map((c: { id: string }) => c.id);
      expect(ids).toContain(brunoId);
      expect(ids).not.toContain(anaId);

      // E a casa nova não ganha titular automático.
      const other = await detail(adminToken, otherHouseId);
      expect(other.body.coordinatorId).toBeNull();
      expect(other.body.coordinators.map((c: { id: string }) => c.id)).toContain(anaId);
    });

    it('titular desligado deixa a casa sem titular', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: brunoId })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${brunoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBeNull();
      expect(res.body.coordinators).toEqual([]);
    });

    it('titular que deixa de ser COORDINATOR deixa a casa sem titular', async () => {
      const carlosId = await createStaff('Carlos194', 'COORDINATOR', fixtureHouseId);
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: carlosId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${BASE}/staff/${carlosId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SERVANT' })
        .expect(200);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBeNull();
      expect(res.body.coordinators).toEqual([]);
    });

    // O negativo: manutenção de cadastro do titular não derruba a coluna.
    it('trocar o telefone do titular NÃO derruba o titular', async () => {
      const dianaId = await createStaff('Diana194', 'COORDINATOR', fixtureHouseId);
      await request(app.getHttpServer())
        .patch(`${BASE}/houses/${fixtureHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coordinatorId: dianaId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${BASE}/staff/${dianaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ whatsapp: '(62) 98888-1194', name: 'Diana194 Renomeada' })
        .expect(200);

      const res = await detail(adminToken);
      expect(res.body.coordinatorId).toBe(dianaId);
    });
  });

  describe('CRUD', () => {
    it('creates, updates and deletes a house (admin only)', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Casa E2E ${Date.now()}`, generalCapacity: 8, state: 'SP' })
        .expect(201);
      expect(created.body.id).toBeDefined();
      const id = created.body.id;

      const updated = await request(app.getHttpServer())
        .patch(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Casa E2E (renomeada)' })
        .expect(200);
      expect(updated.body.name).toBe('Casa E2E (renomeada)');

      await request(app.getHttpServer())
        .delete(`${BASE}/houses/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('POST /houses → 403 for a coordinator (admin-only)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/houses`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Casa Proibida ${Date.now()}` });
      expect(res.status).toBe(403);
    });
  });
});
