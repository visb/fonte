import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

// Minimal valid 1x1 transparent PNG (used for the happy-path image upload).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('DocumentTemplateController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;

  // Unique suffix so template names never collide with seed data or a prior run.
  const tag = `e2e-${Date.now()}`;
  const createdNames: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    // resident_documents reference templates; clear any dependents first, then the
    // templates created by this suite (matched by the unique tag) so no state leaks.
    if (createdNames.length) {
      await dataSource.query(
        `DELETE FROM resident_documents WHERE template_id IN (SELECT id FROM document_templates WHERE name = ANY($1))`,
        [createdNames],
      );
      await dataSource.query(`DELETE FROM document_templates WHERE name = ANY($1)`, [createdNames]);
    }
    await app.close();
  });

  // ── Auth / authorization ────────────────────────────────────────────────────

  describe('authentication', () => {
    it('GET /document-templates → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/document-templates`).expect(401));

    it('GET /document-templates → 200 for SERVANT (list is ADMIN/COORDINATOR/SERVANT)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        }));
  });

  describe('authorization by role', () => {
    let templateId: string;

    beforeAll(async () => {
      const name = `Termo (auth) ${tag}`;
      createdNames.push(name);
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>auth</p>' })
        .expect(201);
      templateId = res.body.id;
    });

    it('GET /:id → 403 for SERVANT (detail is ADMIN/COORDINATOR only)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('POST → 403 for SERVANT (write is ADMIN/COORDINATOR only)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send({ name: `Nao deve criar ${tag}`, content: '<p>x</p>' })
        .expect(403));

    it('PUT /:id → 403 for SERVANT', () =>
      request(app.getHttpServer())
        .put(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send({ name: `Renomeado ${tag}` })
        .expect(403));

    it('DELETE /:id → 403 for SERVANT', () =>
      request(app.getHttpServer())
        .delete(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('POST /images → 403 for SERVANT', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates/images`)
        .set('Authorization', `Bearer ${servantToken}`)
        .attach('file', TINY_PNG, { filename: 'pixel.png', contentType: 'image/png' })
        .expect(403));
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('GET /:id with invalid UUID → 400 (ParseUUIDPipe)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/document-templates/not-a-uuid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('POST with a duplicate name → 409 (ConflictException)', async () => {
      const name = `Termo duplicado ${tag}`;
      createdNames.push(name);
      await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>dup</p>' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>dup 2</p>' })
        .expect(409);
    });

    it('PUT renaming to an existing name → 409', async () => {
      const nameA = `Termo A ${tag}`;
      const nameB = `Termo B ${tag}`;
      createdNames.push(nameA, nameB);
      await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: nameA, content: '<p>a</p>' })
        .expect(201);
      const resB = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: nameB, content: '<p>b</p>' })
        .expect(201);
      // renaming B to A collides → 409
      await request(app.getHttpServer())
        .put(`${BASE}/document-templates/${resB.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: nameA })
        .expect(409);
    });
  });

  // ── Happy CRUD ──────────────────────────────────────────────────────────────

  describe('CRUD happy path', () => {
    let templateId: string;
    const name = `Termo CRUD ${tag}`;
    const renamed = `Termo CRUD renomeado ${tag}`;

    beforeAll(() => {
      createdNames.push(name, renamed);
    });

    it('POST creates a template → 201 with id and flags', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name, content: '<p>Olá {{name}}</p>', isRequired: true, signAtAdmission: true })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(name);
      expect(res.body.content).toBe('<p>Olá {{name}}</p>');
      expect(res.body.isRequired).toBe(true);
      expect(res.body.signAtAdmission).toBe(true);
      templateId = res.body.id;
    });

    it('GET /:id returns the created template', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.id).toBe(templateId);
      expect(res.body.name).toBe(name);
    });

    it('GET list includes the created template', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: { id: string }) => t.id === templateId)).toBe(true);
    });

    it('PUT updates name/content/flags and the change is reflected on GET', async () => {
      const upd = await request(app.getHttpServer())
        .put(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: renamed, content: '<p>novo conteúdo</p>', isRequired: false })
        .expect(200);
      expect(upd.body.name).toBe(renamed);
      expect(upd.body.content).toBe('<p>novo conteúdo</p>');
      expect(upd.body.isRequired).toBe(false);
      // still signAtAdmission true (not sent → unchanged)
      expect(upd.body.signAtAdmission).toBe(true);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.name).toBe(renamed);
      expect(res.body.content).toBe('<p>novo conteúdo</p>');
    });

    it('DELETE → 204 and a subsequent GET → 404', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`${BASE}/document-templates/${templateId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(404);
    });
  });

  // ── Content normalization without S3 (no-op pass-through — story 76) ─────────

  describe('content normalization (non-S3 mode, story 76)', () => {
    it('PUT with a signed <img> src passes the URL through intact when not in S3 mode', async () => {
      // Story 76: signContentUrls/stripContentSignatures are no-ops without AWS_*
      // in .env.test, so a presigned-looking src is persisted verbatim. When the
      // test env gains S3 this case becomes the canonicalization proof instead.
      const name = `Termo img ${tag}`;
      createdNames.push(name);
      const signedSrc =
        'https://example-bucket.s3.amazonaws.com/documents/x.png?X-Amz-Signature=abc123&X-Amz-Expires=900';
      const content = `<p>foto</p><img src="${signedSrc}" />`;
      const created = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`${BASE}/document-templates/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content })
        .expect(200);
      // Non-S3 mode: URL (signature included) is preserved untouched.
      expect(res.body.content).toContain('X-Amz-Signature=abc123');
      expect(res.body.content).toBe(content);
    });
  });

  // ── Image upload ────────────────────────────────────────────────────────────

  describe('image upload (POST /document-templates/images)', () => {
    it('without a file → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('with a non-image file → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('hello plain text'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        })
        .expect(400));

    it('with a small valid image → 201 and { url } defined', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', TINY_PNG, { filename: 'pixel.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.url).toBeDefined();
      // Non-S3 mode: the file lands under /uploads/documents/...
      expect(res.body.url).toContain('/uploads/documents/');
    });
  });
});
