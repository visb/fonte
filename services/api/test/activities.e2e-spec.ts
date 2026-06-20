import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ActivityStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('ActivityController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let coordHouseId: string;
  let coordStaffId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId: coordHouseId } = await loginCoordinator(app));

    const me = await request(app.getHttpServer())
      .get(`${BASE}/staff/me`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    coordStaffId = me.body.id;

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM activity_events');
    await dataSource.query('DELETE FROM activity_comments');
    await dataSource.query('DELETE FROM activities');
    await app.close();
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authentication', () => {
    it('GET /activities → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/activities`).expect(401));
  });

  describe('validation', () => {
    it('POST /activities → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({})
        .expect(400));
  });

  // ── ops (coordinator) flow ──────────────────────────────────────────────────

  describe('ops flow: draft → requested', () => {
    let activityId: string;

    it('coordinator creates a draft (forced to DRAFT)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Trocar lâmpada do corredor', houseId: coordHouseId })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ActivityStatus.DRAFT);
      activityId = res.body.id;
    });

    it('coordinator submits its own draft (DRAFT → REQUESTED)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.REQUESTED);
    });

    it('coordinator cannot approve a request (REQUESTED → TODO is ADMIN only) → 403', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.TODO, responsibleStaffId: coordStaffId })
        .expect(403));

    it('admin approves the request and assigns a responsible (REQUESTED → TODO)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ActivityStatus.TODO, responsibleStaffId: coordStaffId })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.TODO);
      expect(res.body.responsibleStaffId).toBe(coordStaffId);
    });

    it('responsible coordinator moves the card (TODO → DOING)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.DOING })
        .expect(200);
      expect(res.body.status).toBe(ActivityStatus.DOING);
    });

    it('rejects an invalid transition (DOING → REQUESTED) → 400', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(400));

    it('creator cannot edit the description once DOING → 403 (story 62)', () =>
      request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ description: 'tarde demais' })
        .expect(403));

    it('admin can edit the description even when DOING (story 62)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'override pelo admin' })
        .expect(200);
      expect(res.body.description).toBe('override pelo admin');
    });

    it('list (GET /activities) does NOT carry description (story 71)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const item = res.body.find(
        (a: { id: string }) => a.id === activityId,
      );
      expect(item).toBeDefined();
      // O texto existe (foi editado acima) mas a LISTA o omite do payload.
      expect(item).not.toHaveProperty('description');
    });

    it('detail (GET /activities/:id) DOES carry description (story 71)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.description).toBe('override pelo admin');
    });

    it('sanitizes the markdown description on update (story 72)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description:
            'Tarefa **importante** [ok](https://x.com) [ruim](javascript:alert(1)) <script>steal()</script>',
        })
        .expect(200);
      // HTML bruto removido + protocolo perigoso neutralizado; markdown legítimo preservado.
      expect(res.body.description).toContain('**importante**');
      expect(res.body.description).toContain('[ok](https://x.com)');
      expect(res.body.description).toContain('[ruim](#)');
      expect(res.body.description).not.toContain('javascript:');
      expect(res.body.description).not.toContain('<script');
    });
  });

  // ── admin flow / scoping ────────────────────────────────────────────────────

  describe('admin create in TODO requires a responsible', () => {
    it('admin POST in TODO without responsible → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Direto a fazer', status: ActivityStatus.TODO })
        .expect(400));

    it('admin POST in TODO with responsible → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Direto a fazer',
          status: ActivityStatus.TODO,
          houseId: coordHouseId,
          responsibleStaffId: coordStaffId,
        })
        .expect(201);
      expect(res.body.status).toBe(ActivityStatus.TODO);
    });
  });

  describe('scoping', () => {
    let houselessId: string;

    it('admin creates a houseless draft', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Atividade geral (sem casa)' })
        .expect(201);
      houselessId = res.body.id;
    });

    it('coordinator does not see the houseless activity in the list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a: { id: string }) => a.id === houselessId)).toBe(false);
      // but only sees its own house
      expect(res.body.every((a: { houseId: string }) => a.houseId === coordHouseId)).toBe(true);
    });

    it('coordinator gets 404 fetching a houseless activity', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(404));

    it('admin sees the houseless activity', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200));
  });

  // ── comments (story 65) ──────────────────────────────────────────────────────

  describe('comments', () => {
    let activityId: string;
    let houselessId: string;
    let coordCommentId: string;
    let adminCommentId: string;

    beforeAll(async () => {
      // atividade na casa do coordenador (visível ao coord e ao admin)
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Atividade para comentar', houseId: coordHouseId })
        .expect(201);
      activityId = res.body.id;

      // atividade sem casa (só o admin enxerga)
      const houseless = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Atividade geral para comentar' })
        .expect(201);
      houselessId = houseless.body.id;
    });

    it('GET comments of a visible activity returns an empty list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('POST → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ body: '' })
        .expect(400));

    it('coordinator comments on a visible activity', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ body: 'Primeiro comentário do coordenador' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.body).toBe('Primeiro comentário do coordenador');
      expect(res.body.activityId).toBe(activityId);
      coordCommentId = res.body.id;
    });

    it('admin comments on the same activity (author resolved by name)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Comentário do admin' })
        .expect(201);
      adminCommentId = res.body.id;
    });

    it('lists comments in chronological order', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.map((c: { body: string }) => c.body)).toEqual([
        'Primeiro comentário do coordenador',
        'Comentário do admin',
      ]);
    });

    it('coordinator cannot list comments of a houseless activity → 404', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(404));

    it('coordinator cannot comment on a houseless activity → 404', () =>
      request(app.getHttpServer())
        .post(`${BASE}/activities/${houselessId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ body: 'fora de escopo' })
        .expect(404));

    it('a third party (not author, not admin) cannot delete a comment → 403', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/activities/${activityId}/comments/${adminCommentId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403));

    it('the author deletes its own comment → 204', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/activities/${activityId}/comments/${coordCommentId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204));

    it('admin can delete another user comment → 204', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/activities/${activityId}/comments/${adminCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204));

    it('deleted comments no longer appear in the list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── history / events (story 66) ──────────────────────────────────────────────

  describe('events (history)', () => {
    let activityId: string;
    let houselessId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Atividade com histórico', houseId: coordHouseId })
        .expect(201);
      activityId = res.body.id;

      const houseless = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Atividade geral com histórico' })
        .expect(201);
      houselessId = houseless.body.id;
    });

    it('a criação já registra um evento CREATED', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((e: { type: string }) => e.type === 'CREATED')).toBe(true);
    });

    it('mudança de status registra STATUS_CHANGED com { from, to }', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/activities/${activityId}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      const statusEvent = res.body.find(
        (e: { type: string }) => e.type === 'STATUS_CHANGED',
      );
      expect(statusEvent).toBeDefined();
      expect(statusEvent.metadata).toEqual({
        from: ActivityStatus.DRAFT,
        to: ActivityStatus.REQUESTED,
      });
      // ordem cronológica decrescente: o STATUS_CHANGED vem antes do CREATED
      expect(res.body[0].type).toBe('STATUS_CHANGED');
    });

    it('comentar registra um evento COMMENTED com { commentId }', async () => {
      const comment = await request(app.getHttpServer())
        .post(`${BASE}/activities/${activityId}/comments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ body: 'comentário que vira evento' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      const commented = res.body.find(
        (e: { type: string }) => e.type === 'COMMENTED',
      );
      expect(commented).toBeDefined();
      expect(commented.metadata).toEqual({ commentId: comment.body.id });
    });

    it('o evento resolve o ator pelo nome (staff)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      const created = res.body.find((e: { type: string }) => e.type === 'CREATED');
      expect(created.actor).toBeTruthy();
      expect(typeof created.actor.name).toBe('string');
    });

    it('coordinator não vê o histórico de atividade fora de escopo → 404', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${houselessId}/events`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(404));

    it('GET events → 401 sem token', () =>
      request(app.getHttpServer())
        .get(`${BASE}/activities/${activityId}/events`)
        .expect(401));
  });

  describe('delete', () => {
    it('coordinator cannot delete a non-draft activity → 403', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Para enviar e tentar deletar', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`${BASE}/activities/${created.body.id}/status`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ status: ActivityStatus.REQUESTED })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(403);
    });

    it('coordinator deletes its own draft → 204', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ title: 'Rascunho a apagar', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204);
    });

    it('admin deletes any activity → 204', async () => {
      const created = await request(app.getHttpServer())
        .post(`${BASE}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin apaga', houseId: coordHouseId })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`${BASE}/activities/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });
});
