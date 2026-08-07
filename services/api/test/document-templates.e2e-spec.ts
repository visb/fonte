import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PDFDocument } from 'pdf-lib';
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

  // ── Disponibilidade por status do filho (story 160) ──────────────────────────

  describe('availableFor (story 160)', () => {
    it('POST sem o campo → o template nasce ALL (decisão 6: nada muda de comportamento)', async () => {
      const name = `Termo default ${tag}`;
      createdNames.push(name);
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>x</p>' })
        .expect(201);
      expect(res.body.availableFor).toBe('ALL');
    });

    it('POST grava e devolve o availableFor; o GET também o devolve', async () => {
      const name = `Termo ativo ${tag}`;
      createdNames.push(name);
      const created = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>x</p>', availableFor: 'ACTIVE_ONLY' })
        .expect(201);
      expect(created.body.availableFor).toBe('ACTIVE_ONLY');

      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.availableFor).toBe('ACTIVE_ONLY');
    });

    it('PUT altera o availableFor e a mudança aparece no GET', async () => {
      const name = `Termo mutavel ${tag}`;
      createdNames.push(name);
      const created = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>x</p>' })
        .expect(201);

      const upd = await request(app.getHttpServer())
        .put(`${BASE}/document-templates/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ availableFor: 'INACTIVE_ONLY' })
        .expect(200);
      expect(upd.body.availableFor).toBe('INACTIVE_ONLY');

      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.availableFor).toBe('INACTIVE_ONLY');
    });

    it('POST com valor fora do enum → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Nao deve nascer ${tag}`, content: '<p>x</p>', availableFor: 'SO_OS_ALTOS' })
        .expect(400));

    it('PUT com valor fora do enum → 400', async () => {
      const name = `Termo enum ${tag}`;
      createdNames.push(name);
      const created = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>x</p>' })
        .expect(201);
      await request(app.getHttpServer())
        .put(`${BASE}/document-templates/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ availableFor: 'TALVEZ' })
        .expect(400);
    });
  });

  // Esconder o card na tela não é regra: a URL direta do PDF/render tem que
  // recusar. Um filho é levado a DISCHARGED só para esta prova e restaurado.
  describe('geração recusada por status incompatível (story 160)', () => {
    let activeOnlyId: string;
    let inactiveOnlyId: string;
    let residentId: string;
    let originalStatus: string;

    beforeAll(async () => {
      for (const [suffix, availableFor] of [
        ['ativos', 'ACTIVE_ONLY'],
        ['nao-ativos', 'INACTIVE_ONLY'],
      ] as const) {
        const name = `Termo ${suffix} ${tag}`;
        createdNames.push(name);
        const tpl = await request(app.getHttpServer())
          .post(`${BASE}/document-templates`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name, content: '<p>Documento de {{name}}</p>', availableFor })
          .expect(201);
        if (availableFor === 'ACTIVE_ONLY') activeOnlyId = tpl.body.id;
        else inactiveOnlyId = tpl.body.id;
      }

      const [row] = await dataSource.query(
        `SELECT id, status FROM residents WHERE deleted_at IS NULL ORDER BY id LIMIT 1`,
      );
      residentId = row.id;
      originalStatus = row.status;
      await dataSource.query(`UPDATE residents SET status = 'DISCHARGED' WHERE id = $1`, [residentId]);
    });

    afterAll(async () => {
      await dataSource.query(`UPDATE residents SET status = $2 WHERE id = $1`, [
        residentId,
        originalStatus,
      ]);
    });

    it('GET /pdf de template ACTIVE_ONLY para filho em alta → 400', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${activeOnlyId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .then((res) => {
          expect(res.body.message).toContain('não está disponível para o status atual do acolhido');
        }));

    it('GET /render do mesmo template → 400 (a URL direta também é barrada)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${activeOnlyId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('combined-pdf com UM incompatível na lista reprova a requisição inteira', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateIds: [inactiveOnlyId, activeOnlyId] })
        .expect(400));

    it('o template INACTIVE_ONLY, esse sim, gera para o filho em alta', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${inactiveOnlyId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200)
        .then((res) => {
          expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
        }), 120_000);
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

  // ── {{signature}} variable — signer comes from the request token (story 128) ──

  describe('signature variable rendering (story 128)', () => {
    let templateId: string;
    let residentId: string;
    let adminName: string;
    let coordName: string;

    beforeAll(async () => {
      const name = `Termo assinatura ${tag}`;
      createdNames.push(name);
      const tpl = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: 'Assinado por: {{signature}}' })
        .expect(201);
      templateId = tpl.body.id;

      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      residentId = residents.body.data[0].id;

      // Admin configura a própria assinatura (PNG) — o signer sai do token.
      await request(app.getHttpServer())
        .post(`${BASE}/staff/me/signature`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', TINY_PNG, { filename: 'sig.png', contentType: 'image/png' })
        .expect(201);

      const adminMe = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      adminName = adminMe.body.name;
      const coordMe = await request(app.getHttpServer())
        .get(`${BASE}/staff/me`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      coordName = coordMe.body.name;
    });

    it('render embeds the signature block of the TOKEN user, never raw {{signature}}', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.text).toContain('doc-signature');
      expect(res.text).toContain('<img class="doc-signature-img"');
      expect(res.text).toContain(adminName);
      expect(res.text).not.toContain('{{signature}}');
      // Story 135 — em modo local (não-S3) a assinatura é inline como data URI
      // (puppeteer não resolve /uploads/... sem base URL). O <img> nunca sai com
      // caminho relativo quebrado.
      expect(res.text).toContain('src="data:image/png;base64,');
      expect(res.text).not.toContain('src="/uploads/');
    });

    it('a different token user yields a different signer (per-token signature)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.text).toContain(coordName);
      // nomes distintos comprovam que a assinatura vem do usuário do token
      expect(coordName).not.toBe(adminName);
    });
  });

  // ── {{residentPhoto}} — foto do acolhido no documento (story 157) ────────────

  describe('resident photo variable rendering (story 157)', () => {
    let templateId: string;
    let withPhotoId: string;
    let withoutPhotoId: string;

    beforeAll(async () => {
      const name = `Termo foto ${tag}`;
      createdNames.push(name);
      const tpl = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p style="text-align: center">{{residentPhoto}}</p><p>{{name}}</p>' })
        .expect(201);
      templateId = tpl.body.id;

      // Um acolhido ganha foto de verdade (POST /residents/:id/photo)...
      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      withPhotoId = residents.body.data[0].id;
      await request(app.getHttpServer())
        .post(`${BASE}/residents/${withPhotoId}/photo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', TINY_PNG, { filename: 'foto.png', contentType: 'image/png' })
        .expect(201);

      // ...e outro fica sem nenhuma, para provar a moldura vazia.
      const [semFoto] = await dataSource.query(
        `SELECT id FROM residents WHERE photo_url IS NULL AND deleted_at IS NULL AND id <> $1 LIMIT 1`,
        [withPhotoId],
      );
      withoutPhotoId = semFoto?.id;
      expect(withoutPhotoId).toBeDefined();
    });

    it('acolhido COM foto → a imagem entra no documento, nunca o token cru', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${withPhotoId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toContain('<div class="doc-photo" style="text-align:center">');
      expect(res.text).toContain('<img class="doc-photo-img"');
      expect(res.text).not.toContain('{{residentPhoto}}');
      expect(res.text).not.toContain('<div class="doc-photo-placeholder">');
      // Story 135 — modo local (não-S3): a foto sai inline como data URI, nunca
      // como /uploads/... (que o puppeteer não resolveria no PDF).
      expect(res.text).toContain('src="data:image/png;base64,');
      expect(res.text).not.toContain('src="/uploads/');
    });

    it('acolhido SEM foto → moldura vazia rotulada, nunca o token cru', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${withoutPhotoId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toContain('<div class="doc-photo-placeholder">Foto</div>');
      expect(res.text).not.toContain('<img class="doc-photo-img"');
      expect(res.text).not.toContain('{{residentPhoto}}');
    });
  });

  // ── {{exitDate}} — data de saída no documento (story 159) ────────────────────

  describe('exit date variable rendering (story 159)', () => {
    let templateId: string;
    let withExitId: string;
    let withoutExitId: string;
    // exit_date original de cada filho tocado, restaurado no afterAll para a
    // suíte não deixar estado (o seed é compartilhado com os outros specs).
    const originalExitDates = new Map<string, unknown>();

    beforeAll(async () => {
      const name = `Termo saida ${tag}`;
      createdNames.push(name);
      const tpl = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: '<p>Entrada: {{entryDate}} | Saída: {{exitDate}}</p>' })
        .expect(201);
      templateId = tpl.body.id;

      // `entry_date IS NOT NULL` porque o template também imprime a entrada: com
      // entrada nula o traço `___/___/______` viria dela e sujaria a asserção da
      // saída (que é justamente NÃO imprimir o traço).
      const rows = await dataSource.query(
        `SELECT id, exit_date FROM residents
          WHERE deleted_at IS NULL AND entry_date IS NOT NULL ORDER BY id LIMIT 2`,
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) originalExitDates.set(row.id, row.exit_date);
      withExitId = rows[0].id;
      withoutExitId = rows[1].id;
      // Estado determinístico: um filho com data de saída, outro sem nenhuma.
      await dataSource.query(`UPDATE residents SET exit_date = '2026-03-09' WHERE id = $1`, [
        withExitId,
      ]);
      await dataSource.query(`UPDATE residents SET exit_date = NULL WHERE id = $1`, [
        withoutExitId,
      ]);
    });

    afterAll(async () => {
      for (const [id, exitDate] of originalExitDates) {
        await dataSource.query(`UPDATE residents SET exit_date = $2 WHERE id = $1`, [id, exitDate]);
      }
    });

    it('filho COM data de saída → a data no documento, nunca o token cru', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${withExitId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toContain('09/03/2026');
      expect(res.text).not.toContain('{{exitDate}}');
      expect(res.text).not.toContain('{{entryDate}}');
    });

    it('filho ATIVO (sem saída) → "não informado", nunca o traço nem o token cru', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${withoutExitId}/documents/${templateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toContain('Saída: não informado');
      expect(res.text).not.toContain('___/___/______');
      expect(res.text).not.toContain('{{exitDate}}');
    });
  });

  // ── PDF combinado para impressão em lote (story 152) ─────────────────────────

  describe('combined PDF (story 152)', () => {
    const templateIds: string[] = [];
    let residentId: string;

    beforeAll(async () => {
      for (const suffix of ['A', 'B']) {
        const name = `Termo combinado ${suffix} ${tag}`;
        createdNames.push(name);
        const tpl = await request(app.getHttpServer())
          .post(`${BASE}/document-templates`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name, content: `<p>Documento ${suffix} de {{name}}</p>`, isRequired: true })
          .expect(201);
        templateIds.push(tpl.body.id);
      }

      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      residentId = residents.body.data[0].id;
    });

    // Renderiza de verdade (puppeteer) os dois templates e mescla: é o gate que
    // garante que o merge produz um PDF válido, não um HTML concatenado.
    it('POST /residents/:id/documents/combined-pdf → 200 com um PDF não vazio', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateIds })
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename="');
      expect(res.headers['content-disposition']).toContain('-documentos.pdf"');
      const body = res.body as Buffer;
      expect(body.length).toBeGreaterThan(0);
      expect(body.subarray(0, 4).toString()).toBe('%PDF');
    }, 120_000);

    it('templateIds vazio → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateIds: [] })
        .expect(400));

    it('templateIds com id inválido → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateIds: ['nao-uuid'] })
        .expect(400));

    it('sem token → 401', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .send({ templateIds })
        .expect(401));
  });

  // ── Margem de página em TODAS as páginas (story 154) ─────────────────────────

  describe('page margin on every page (story 154)', () => {
    let templateId: string;
    let residentId: string;

    beforeAll(async () => {
      const name = `Termo multipagina ${tag}`;
      createdNames.push(name);
      // Parágrafos independentes o bastante para estourar a página: a quebra cai
      // ENTRE parágrafos, sem depender de fragmentação dentro de um bloco só.
      const paragraphs = Array.from(
        { length: 90 },
        (_, i) => `<p>Parágrafo ${i + 1} — texto de enchimento para forçar a quebra de página.</p>`,
      ).join('');
      const tpl = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, content: `<p>Documento de {{name}}</p>${paragraphs}` })
        .expect(201);
      templateId = tpl.body.id;

      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      residentId = residents.body.data[0].id;
    });

    // Antes da story 154 a margem era o `padding` do body (caixa do fluxo): só
    // aparecia no topo da 1ª página e no pé da última. Agora é margem da PÁGINA
    // (`@page` + opção do puppeteer), então a folha continua A4 e o conteúdo é
    // reduzido pela margem em vez de a margem comer o papel.
    it('GET /:id/documents/:templateId/pdf → PDF de 2+ páginas, todas em A4', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${templateId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      const body = res.body as Buffer;
      expect(body.subarray(0, 4).toString()).toBe('%PDF');

      const pdf = await PDFDocument.load(body);
      // O conteúdo quebrou: existe uma página 2 (que é justamente a que saía sem
      // margem nenhuma antes desta story).
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
      // Toda página segue medindo A4 (~595 × 842 pt) — a margem não veio às custas
      // do tamanho do papel. Tolerância de 1pt porque o Chrome arredonda o A4 para
      // 8.27 × 11.69 pol (595.92 × 841.68pt) em vez dos 595.28 × 841.89 exatos.
      for (const page of pdf.getPages()) {
        expect(page.getWidth()).toBeGreaterThan(594);
        expect(page.getWidth()).toBeLessThan(597);
        expect(page.getHeight()).toBeGreaterThan(841);
        expect(page.getHeight()).toBeLessThan(843);
      }
    }, 120_000);
  });
});
