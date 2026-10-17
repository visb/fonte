import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

/**
 * Story 178 — recibo da contribuição mensal, ponta a ponta.
 *
 * Prova as duas metades da story:
 *  1. a rota nova (`GET /associates/charges/:chargeId/receipt`) devolve PDF para
 *     ADMIN/COORDINATOR e recusa o resto;
 *  2. o ISOLAMENTO: `GET /document-templates` sem `kind` NÃO traz o recibo
 *     cadastrado aqui — é o que garante que ele não apareça na aba de Anexos de
 *     nenhum filho (decisão 8).
 */
describe('Receipts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let relativeToken: string;

  const tag = `e2e-receipt-${Date.now()}`;
  const receiptTemplateName = `Recibo contribuição ${tag}`;
  let receiptTemplateId: string;
  let associateId: string;
  let paidChargeId: string;
  let pendingChargeId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    relativeToken = await login(app, 'familiar@fonte.com', 'familiar123');
    dataSource = app.get(DataSource);

    // Associado + duas cobranças (uma paga, outra pendente) direto no banco: o
    // fluxo de pagamento real depende do Pagar.me, que não tem credencial aqui.
    const created = await request(app.getHttpServer())
      .post(`${BASE}/associates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Associado recibo ${tag}`,
        whatsapp: '+5562988881111',
        contributionAmount: 50,
        dueDay: 10,
      })
      .expect(201);
    associateId = created.body.id;

    const [paid] = await dataSource.query(
      `INSERT INTO associate_charges
         (associate_id, net_amount, fee_amount, gross_amount, status, due_date, paid_at)
       VALUES ($1, 50, 1.75, 51.75, 'PAID', '2026-08-10', '2026-08-09T12:00:00Z')
       RETURNING id`,
      [associateId],
    );
    paidChargeId = paid.id;
    const [pending] = await dataSource.query(
      `INSERT INTO associate_charges
         (associate_id, net_amount, fee_amount, gross_amount, status, due_date)
       VALUES ($1, 50, 1.75, 51.75, 'PENDING', '2026-09-10')
       RETURNING id`,
      [associateId],
    );
    pendingChargeId = pending.id;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM issued_receipts WHERE subject_id = ANY($1)`, [
      [paidChargeId, pendingChargeId],
    ]);
    await dataSource.query(`DELETE FROM associate_charges WHERE associate_id = $1`, [associateId]);
    await dataSource.query(`DELETE FROM associates WHERE id = $1`, [associateId]);
    if (receiptTemplateId) {
      await dataSource.query(`DELETE FROM document_templates WHERE id = $1`, [receiptTemplateId]);
    }
    await app.close();
    // `app.close()` derruba o browser do puppeteer: sob carga passa dos 5s padrão.
  }, 30_000);

  // ── Sem template cadastrado ─────────────────────────────────────────────────

  describe('sem template do tipo cadastrado', () => {
    it('→ 404 com a mensagem acionável (nada de 404 mudo para o operador)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.message).toContain('Configurações → Templates');
          // Story 212, decisão 7.
          expect(res.body.code).toBe('RECEIPT_TEMPLATE_MISSING');
          expect(res.body.receiptType).toBe('ASSOCIATE_CONTRIBUTION');
        }));
  });

  // ── Cadastro do template de recibo ──────────────────────────────────────────

  describe('cadastro do template de recibo', () => {
    it('POST com kind=RECEIPT força isRequired/signAtAdmission false e availableFor ALL', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: receiptTemplateName,
          content:
            '<p>Recibo nº {{receiptNumber}} — {{payerName}} — {{amount}} ({{amountInWords}})</p>' +
            '<p>Competência {{referenceMonth}}, pago em {{paymentDate}}.</p><p>{{signature}}</p>',
          kind: 'RECEIPT',
          receiptType: 'ASSOCIATE_CONTRIBUTION',
          // Mandados de propósito: o service tem que ignorá-los.
          isRequired: true,
          signAtAdmission: true,
          availableFor: 'ACTIVE_ONLY',
        })
        .expect(201);
      receiptTemplateId = res.body.id;
      expect(res.body.kind).toBe('RECEIPT');
      expect(res.body.receiptType).toBe('ASSOCIATE_CONTRIBUTION');
      expect(res.body.isRequired).toBe(false);
      expect(res.body.signAtAdmission).toBe(false);
      expect(res.body.availableFor).toBe('ALL');
    });

    it('segundo template do MESMO receiptType → 409', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Recibo duplicado ${tag}`,
          content: '<p>x</p>',
          kind: 'RECEIPT',
          receiptType: 'ASSOCIATE_CONTRIBUTION',
        })
        .expect(409));

    it('RECEIPT sem receiptType → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Recibo sem tipo ${tag}`, content: '<p>x</p>', kind: 'RECEIPT' })
        .expect(400));

    it('RESIDENT com receiptType → 400', () =>
      request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Termo com tipo ${tag}`,
          content: '<p>x</p>',
          receiptType: 'ASSOCIATE_CONTRIBUTION',
        })
        .expect(400));

    it('kind fora do enum → 400', () =>
      request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .query({ kind: 'BOLETO' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));
  });

  // ── Isolamento (decisão 8) — o teste que a story pede ────────────────────────

  describe('isolamento do recibo na listagem de templates', () => {
    it('GET /document-templates SEM kind não traz o recibo (a aba de Anexos nunca o vê)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: { id: string }) => t.id === receiptTemplateId)).toBe(false);
      // …e o que já existia continua lá: o default não escondeu documento de filho.
      expect(res.body.every((t: { kind: string }) => t.kind === 'RESIDENT')).toBe(true);
    });

    it('GET /document-templates?kind=RECEIPT traz o recibo, e só recibos', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .query({ kind: 'RECEIPT' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: { id: string }) => t.id === receiptTemplateId)).toBe(true);
      expect(res.body.every((t: { kind: string }) => t.kind === 'RECEIPT')).toBe(true);
    });

    it('o PDF do template de recibo pela URL do filho → 400 (sumir da tela não é regra)', async () => {
      const residents = await request(app.getHttpServer())
        .get(`${BASE}/residents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const residentId = residents.body.data[0].id;
      await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/documents/${receiptTemplateId}/render`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/documents/combined-pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateIds: [receiptTemplateId] })
        .expect(400);
    });
  });

  // ── Rota do recibo ──────────────────────────────────────────────────────────

  describe('GET /associates/charges/:chargeId/receipt', () => {
    it('sem token → 401', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .expect(401));

    it('SERVANT → 403', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('RELATIVE → 403', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .set('Authorization', `Bearer ${relativeToken}`)
        .expect(403));

    it('chargeId inválido → 400 (ParseUUIDPipe)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/nao-uuid/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('cobrança inexistente → 404', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/00000000-0000-4000-8000-000000000000/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));

    it('cobrança não paga → 400', () =>
      request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${pendingChargeId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .then((res) => {
          expect(res.body.message).toContain('cobrança paga');
        }));

    it('ADMIN → 200 com application/pdf e o número no nome do arquivo', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer()
        // supertest não sabe parsear application/pdf: coleta o corpo bruto.
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(
        /attachment; filename="recibo-contribuicao-\d{6}\.pdf"/,
      );
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    }, 120_000);

    it('COORDINATOR também baixa, e o número NÃO é queimado de novo (idempotência)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/associates/charges/${paidChargeId}/receipt`)
        .set('Authorization', `Bearer ${coordToken}`)
        .buffer()
        // supertest não sabe parsear application/pdf: coleta o corpo bruto.
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      const rows = await dataSource.query(
        `SELECT number FROM issued_receipts WHERE subject_id = $1`,
        [paidChargeId],
      );
      expect(rows).toHaveLength(1);
    }, 120_000);
  });

  // ── Migration aplicada (Validação › Migration do plano) ──────────────────────

  describe('schema da story', () => {
    it('templates pré-existentes ficaram kind=RESIDENT e receipt_type NULL', async () => {
      const [row] = await dataSource.query(
        `SELECT COUNT(*)::int AS wrong FROM document_templates
          WHERE kind IS DISTINCT FROM 'RESIDENT' AND receipt_type IS NULL`,
      );
      expect(row.wrong).toBe(0);
    });

    it('o índice único parcial rejeita um segundo template do mesmo receipt_type', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO document_templates (name, content, kind, receipt_type)
           VALUES ($1, '<p>x</p>', 'RECEIPT', 'ASSOCIATE_CONTRIBUTION')`,
          [`Recibo direto no banco ${tag}`],
        ),
      ).rejects.toThrow();
    });

    it('issued_receipts é único por (receipt_type, subject_type, subject_id)', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO issued_receipts (receipt_type, number, subject_type, subject_id)
           VALUES ('ASSOCIATE_CONTRIBUTION', 9999, 'ASSOCIATE_CHARGE', $1)`,
          [paidChargeId],
        ),
      ).rejects.toThrow();
    });
  });
});
