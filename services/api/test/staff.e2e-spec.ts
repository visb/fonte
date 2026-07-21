import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Role } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

// Minimal 1x1 transparent PNG for the signature upload happy-path.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('StaffController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  const createdIds: string[] = [];

  let servantToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app.getHttpServer()).delete(`${BASE}/staff/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('authentication & authorization', () => {
    it('GET /staff → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/staff`).expect(401));

    it('POST /staff → 403 for a coordinator (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: 'X', password: 'secret123', role: Role.SERVANT });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /staff/me', () => {
    it('returns the coordinator profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.houseId).toBeDefined();
    });
  });

  describe('validation', () => {
    it('POST /staff → 400 with empty body', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400));

    it('POST /staff → 400 for a too-short password', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X', password: '123', role: Role.SERVANT })
        .expect(400));

    // Story 96 — campos clínicos/de tratamento foram removidos do DTO. Com
    // forbidNonWhitelisted, enviá-los deve resultar em 400.
    it('POST /staff → 400 when sending a removed treatment field', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Y', password: 'secret123', role: Role.SERVANT, addiction: 'Álcool' })
        .expect(400));
  });

  describe('CRUD', () => {
    it('creates a servant WITHOUT email (e-mail opcional)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Servo Sem Email ${Date.now()}`, password: 'secret123', role: Role.SERVANT, rank: 'ASPIRANTE' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('creates a servant with personal fields but no clinical/treatment fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Servo Ficha ${Date.now()}`,
          password: 'secret123',
          role: Role.SERVANT,
          cpf: '123.456.789-00',
          occupation: 'Auxiliar',
        })
        .expect(201);
      createdIds.push(res.body.id);
      expect(res.body.cpf).toBe('123.456.789-00');
      expect(res.body.occupation).toBe('Auxiliar');
      expect(res.body).not.toHaveProperty('addiction');
      expect(res.body).not.toHaveProperty('healthIssues');
      expect(res.body).not.toHaveProperty('continuousMedication');
      expect(res.body).not.toHaveProperty('weight');
      expect(res.body).not.toHaveProperty('height');
    });

    it('creates a servant WITH email, then rejects the duplicate', async () => {
      const email = `servo-${Date.now()}@fonte.com`;
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Servo Com Email', email, password: 'secret123', role: Role.SERVANT })
        .expect(201);
      createdIds.push(res.body.id);

      await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Outro', email, password: 'secret123', role: Role.SERVANT })
        .expect(409);
    });

    // Story 97 — o campo é whatsapp (coluna renomeada) e é persistido em dígitos.
    it('creates a servant with whatsapp normalized to digits, and phone is rejected', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Servo Zap ${Date.now()}`,
          password: 'secret123',
          role: Role.SERVANT,
          whatsapp: '(62) 98888-0001',
        })
        .expect(201);
      createdIds.push(res.body.id);
      expect(res.body.whatsapp).toBe('62988880001');
      expect(res.body).not.toHaveProperty('phone');

      // `phone` deixou de existir no DTO → 400 (forbidNonWhitelisted).
      await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Servo Phone', password: 'secret123', role: Role.SERVANT, phone: '629' })
        .expect(400);
    });

    it('updates the staff whatsapp normalizing to digits', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ whatsapp: '(62) 97777-0009' })
        .expect(200);
      expect(res.body.whatsapp).toBe('62977770009');
    });

    it('updates a staff name', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Servo Renomeado' })
        .expect(200);
      expect(res.body.name).toBe('Servo Renomeado');
    });

    it('GET /staff/:id → 404 for an unknown id', () =>
      request(app.getHttpServer())
        .get(`${BASE}/staff/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));
  });

  // ─── Signature (story 128) ──────────────────────────────────────────────────

  describe('signature', () => {
    it('POST /staff/me/signature → 401 without token', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff/me/signature`)
        .attach('file', TINY_PNG, { filename: 'sig.png', contentType: 'image/png' })
        .expect(401));

    it('POST /staff/me/signature → 400 for a non-PNG file (transparency requires PNG)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${coordToken}`)
        .attach('file', Buffer.from('fake-jpeg'), { filename: 'sig.jpg', contentType: 'image/jpeg' })
        .expect(400));

    it('uploads a PNG signature and GET /staff/me returns signatureUrl', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${coordToken}`)
        .attach('file', TINY_PNG, { filename: 'sig.png', contentType: 'image/png' })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(me.body.signatureUrl).toBeTruthy();
    });

    // Story 138 — redefinir (remover) a assinatura do próprio perfil.
    it('DELETE /staff/me/signature → 401 without token', () =>
      request(app.getHttpServer()).delete(`${BASE}/staff/me/signature`).expect(401));

    it('removes the signature (upload → DELETE → GET me sem signatureUrl) and is idempotent', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${coordToken}`)
        .attach('file', TINY_PNG, { filename: 'sig.png', contentType: 'image/png' })
        .expect(201);

      const removed = await request(app.getHttpServer())
        .delete(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(removed.body.signatureUrl).toBeNull();

      const me = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(me.body.signatureUrl).toBeNull();

      // Segunda remoção não falha (idempotente).
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
    });
  });

  // ─── Attachments (story 98) ─────────────────────────────────────────────────

  describe('attachments', () => {
    let staffId: string;
    let attachmentId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Servo Anexos ${Date.now()}`, password: 'secret123', role: Role.SERVANT })
        .expect(201);
      staffId = res.body.id;
      createdIds.push(staffId);
    });

    it('GET /staff/:id/attachments → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/staff/${staffId}/attachments`).expect(401));

    it('attachment routes → 403 for a servant (ADMIN/COORDINATOR only)', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${servantToken}`)
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${staffId}/attachments/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403);
    });

    it('rejects a file outside the mimetype allowlist → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('MZ-fake-exe'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400));

    it('POST attachment to an unknown staff → 404', () =>
      request(app.getHttpServer())
        .post(`${BASE}/staff/00000000-0000-0000-0000-000000000000/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' })
        .expect(404));

    it('coordinator uploads a pdf → 201 with the persisted metadata', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${coordToken}`)
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'contrato.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.staffId).toBe(staffId);
      expect(res.body.fileName).toBe('contrato.pdf');
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.sizeBytes).toBeGreaterThan(0);
      expect(res.body.createdByUserId).toBeDefined();
      attachmentId = res.body.id;
    });

    it('lists the staff attachments', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.map((a: { id: string }) => a.id)).toContain(attachmentId);
    });

    it('DELETE an unknown attachment → 404', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/staff/${staffId}/attachments/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));

    it('deletes the attachment (soft delete) and it leaves the listing', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/staff/${staffId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/staff/${staffId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.map((a: { id: string }) => a.id)).not.toContain(attachmentId);
    });
  });
});
