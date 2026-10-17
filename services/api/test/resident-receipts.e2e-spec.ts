import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  FamilyInvestment,
  PaymentMethod,
  RECEIPT_TEMPLATE_MISSING_CODE,
  residentReceiptFilename,
  todayInSaoPaulo,
} from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 193 — recibo da contribuição mensal do acolhido, ponta a ponta.
 *
 * Prova as três metades da story:
 *  1. a rota do `adm.fonte` (`GET /residents/:id/receivables/:rid/receipt`)
 *     devolve PDF para ADMIN/COORDINATOR e recusa o resto;
 *  2. o familiar lista as PRÓPRIAS parcelas pagas e baixa o PRÓPRIO recibo;
 *  3. o ESCOPO (decisão 10): parcela do filho de outro familiar responde 404 — e
 *     a tentativa negada não deixa linha em `issued_receipts`.
 *
 * A fixture segue a story 182: dois filhos e dois familiares criados pela
 * própria suíte via API, removidos no `afterAll`, limpeza por id acumulado.
 */
describe('Resident contribution receipts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;

  const tag = `e2e-recibo-filho-${Date.now()}`;
  let receiptTemplateId: string;

  // Filho A (do familiar A) e filho B (do familiar B).
  let residentAId: string;
  let residentBId: string;
  let relativeAId: string;
  let relativeBId: string;
  let relativeAToken: string;
  let relativeBToken: string;
  let paidAId: string;
  let paidAReferenceMonth: string;
  let pendingAId: string;
  let paidBId: string;
  const createdUserIds: string[] = [];

  async function createResident(name: string): Promise<string> {
    const today = todayInSaoPaulo();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({
        name,
        houseId,
        entryDate: today,
        familyInvestment: FamilyInvestment.PAYMENT_700,
        contributionDueDay: 10,
      })
      .expect(201);
    return res.body.id as string;
  }

  /** Familiar responsável COM acesso ao app; devolve id + token. */
  async function createRelativeWithAccess(
    residentId: string,
    name: string,
    email: string,
  ): Promise<{ id: string; token: string }> {
    const created = await request(app.getHttpServer())
      .post(`${BASE}/relatives`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ residentId, name, relationship: 'Mãe', isResponsible: true })
      .expect(201);
    const id = created.body.id as string;
    const access = await request(app.getHttpServer())
      .post(`${BASE}/relatives/${id}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password: 'familiar193' })
      .expect(201);
    createdUserIds.push(access.body.userId as string);
    // O acesso nasce com `mustChangePassword` (o guarda global bloquearia toda
    // rota até a troca): a fixture faz o primeiro acesso completo, como o app.
    const first = await login(app, email, 'familiar193');
    const changed = await request(app.getHttpServer())
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${first}`)
      .send({ newPassword: 'familiar193nova' })
      .expect(200);
    return { id, token: changed.body.accessToken as string };
  }

  /** Paga a primeira parcela pendente do carnê e devolve (paga, ainda pendente). */
  async function payFirstInstallment(
    residentId: string,
  ): Promise<{ paidId: string; pendingId: string; referenceMonth: string }> {
    const list = await request(app.getHttpServer())
      .get(`${BASE}/residents/${residentId}/receivables`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    const [first, second] = list.body as { id: string; referenceMonth: string }[];
    await request(app.getHttpServer())
      .post(`${BASE}/residents/${residentId}/receivables/${first.id}/payment`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({
        paidAt: todayInSaoPaulo(),
        paymentMethod: PaymentMethod.PIX,
        paidAmount: 480,
      })
      .expect(201);
    return { paidId: first.id, pendingId: second.id, referenceMonth: first.referenceMonth };
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    dataSource = app.get(DataSource);

    residentAId = await createResident(`Filho A ${tag}`);
    residentBId = await createResident(`Filho B ${tag}`);
    ({
      paidId: paidAId,
      pendingId: pendingAId,
      referenceMonth: paidAReferenceMonth,
    } = await payFirstInstallment(residentAId));
    ({ paidId: paidBId } = await payFirstInstallment(residentBId));

    ({ id: relativeAId, token: relativeAToken } = await createRelativeWithAccess(
      residentAId,
      `Mãe A ${tag}`,
      `familiar-a-${Date.now()}@fonte.test`,
    ));
    ({ id: relativeBId, token: relativeBToken } = await createRelativeWithAccess(
      residentBId,
      `Mãe B ${tag}`,
      `familiar-b-${Date.now()}@fonte.test`,
    ));
  }, 120_000);

  // Limpeza por id acumulado (story 182): a suíte só apaga o que ela criou.
  afterAll(async () => {
    const receivableIds = [paidAId, pendingAId, paidBId].filter(Boolean);
    const residentIds = [residentAId, residentBId].filter(Boolean);
    const relativeIds = [relativeAId, relativeBId].filter(Boolean);

    await dataSource.query(`DELETE FROM issued_receipts WHERE subject_id = ANY($1)`, [
      receivableIds,
    ]);
    await dataSource.query(`DELETE FROM relatives WHERE id = ANY($1)`, [relativeIds]);
    await dataSource.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
    if (residentIds.length) {
      await dataSource.query(`DELETE FROM resident_receivables WHERE resident_id = ANY($1)`, [
        residentIds,
      ]);
      await dataSource.query(`DELETE FROM resident_follow_ups WHERE resident_id = ANY($1)`, [
        residentIds,
      ]);
      await dataSource.query(`DELETE FROM admissions WHERE resident_id = ANY($1)`, [residentIds]);
      await dataSource.query(`DELETE FROM residents WHERE id = ANY($1)`, [residentIds]);
    }
    if (receiptTemplateId) {
      await dataSource.query(`DELETE FROM document_templates WHERE id = ANY($1)`, [
        [receiptTemplateId],
      ]);
    }
    await app.close();
  });

  // ── Sem template do tipo novo ───────────────────────────────────────────────

  describe('sem template do tipo cadastrado', () => {
    it('→ 404 com a mensagem acionável (o operador precisa saber o que fazer)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.message).toContain('Configurações → Templates');
          expect(res.body.message).toContain('acolhido');
          // Story 212, decisão 7 — código legível por máquina + o tipo pedido.
          expect(res.body.code).toBe(RECEIPT_TEMPLATE_MISSING_CODE);
          expect(res.body.receiptType).toBe('RESIDENT_CONTRIBUTION');
        }));

    it('o template ausente é checado ANTES da parcela (mesmo parcela inexistente leva o code)', async () => {
      // O gerador acha o template primeiro (story 178): o 404 de parcela
      // inexistente SEM code só aparece com o template cadastrado — coberto em
      // "parcela inexistente → 404" mais abaixo.
      const res = await request(app.getHttpServer())
        .get(
          `${BASE}/residents/${residentAId}/receivables/00000000-0000-4000-8000-000000000000/receipt`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(res.body.code).toBe(RECEIPT_TEMPLATE_MISSING_CODE);
    });
  });

  // ── Cadastro do template (nenhuma migration: o tipo é DADO) ─────────────────

  describe('cadastro do template do recibo do acolhido', () => {
    it('aceita o receiptType novo sem nenhuma mudança de schema', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Recibo do acolhido ${tag}`,
          content:
            '<p>Recibo nº {{receiptNumber}} — recebi de {{payerName}} ({{payerRelationship}})</p>' +
            '<p>{{amount}} ({{amountInWords}}), referente a {{referenceMonth}} do acolhido ' +
            '{{residentName}} — {{houseName}} — {{paymentMethod}} — {{contributionPlan}}.</p>' +
            '<p>{{signature}}</p>',
          kind: 'RECEIPT',
          receiptType: 'RESIDENT_CONTRIBUTION',
        })
        .expect(201);
      receiptTemplateId = res.body.id;
      expect(res.body.receiptType).toBe('RESIDENT_CONTRIBUTION');
      expect(res.body.kind).toBe('RECEIPT');
    });

    it('o recibo do acolhido NÃO aparece na listagem de documentos do filho', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/document-templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: { id: string }) => t.id === receiptTemplateId)).toBe(false);
    });
  });

  // ── Rota do adm.fonte ───────────────────────────────────────────────────────

  describe('GET /residents/:id/receivables/:receivableId/receipt', () => {
    it('sem token → 401', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .expect(401));

    it('SERVANT → 403', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('RELATIVE → 403 (o familiar tem a rota dele, escopada)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .expect(403));

    it('parcela não paga → 400', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${pendingAId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .then((res) => {
          expect(res.body.message).toContain('parcela paga');
        }));

    it('parcela inexistente → 404 SEM o code de template ausente (story 212)', () =>
      request(app.getHttpServer())
        .get(
          `${BASE}/residents/${residentAId}/receivables/00000000-0000-4000-8000-000000000000/receipt`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.code).toBeUndefined();
        }));

    it('receivableId inválido → 400 (ParseUUIDPipe)', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/nao-uuid/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('ADMIN → 200 com application/pdf e recibo-{filho}-{MM}-{AAAA}.pdf (story 212)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      const expected = residentReceiptFilename(`Filho A ${tag}`, paidAReferenceMonth);
      expect(expected).toMatch(/^recibo-filho-a-e2e-recibo-filho-\d+-\d{2}-\d{4}\.pdf$/);
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${expected}"`);
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    }, 120_000);

    it('COORDINATOR também baixa, e o número NÃO é queimado de novo', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentAId}/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${coordToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      const rows = await dataSource.query(
        `SELECT receipt_type, subject_type FROM issued_receipts WHERE subject_id = $1`,
        [paidAId],
      );
      expect(rows).toHaveLength(1);
      // A prova da aposta da 178: tipo e sujeito novos entraram como DADO nas
      // MESMAS colunas varchar — nenhuma migration nesta story.
      expect(rows[0].receipt_type).toBe('RESIDENT_CONTRIBUTION');
      expect(rows[0].subject_type).toBe('RESIDENT_RECEIVABLE');
    }, 120_000);
  });

  // ── Lista do familiar ───────────────────────────────────────────────────────

  describe('GET /relatives/me/receivables', () => {
    it('sem token → 401', () =>
      request(app.getHttpServer()).get(`${BASE}/relatives/me/receivables`).expect(401));

    it.each([
      ['ADMIN', () => adminToken],
      ['SERVANT', () => servantToken],
    ])('%s → 403 (a rota é do familiar)', (_role, getToken) =>
      request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables`)
        .set('Authorization', `Bearer ${getToken()}`)
        .expect(403));

    it('RELATIVE → só as parcelas PAGAS do próprio filho, sem plano nem produto', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      const [item] = res.body as Record<string, unknown>[];
      expect(item.id).toBe(paidAId);
      expect(item.paidAmount).toBe(480);
      expect(item.paymentMethod).toBe(PaymentMethod.PIX);
      expect(Object.keys(item).sort()).toEqual([
        'id',
        'paidAmount',
        'paidAt',
        'paymentMethod',
        'referenceMonth',
      ]);
    });

    it('a parcela do OUTRO filho não aparece na lista do familiar A', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .expect(200);
      expect(res.body.some((r: { id: string }) => r.id === paidBId)).toBe(false);
    });
  });

  // ── Recibo do familiar (decisão 10, ponta a ponta) ───────────────────────────

  describe('GET /relatives/me/receivables/:receivableId/receipt', () => {
    it('SERVANT → 403', () =>
      request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));

    it('o familiar baixa o recibo do PRÓPRIO filho → 200 PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables/${paidAId}/receipt`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    }, 120_000);

    it('parcela do filho de OUTRO familiar → 404, e nenhum número é queimado', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables/${paidBId}/receipt`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .expect(404);

      const rows = await dataSource.query(
        `SELECT id FROM issued_receipts WHERE subject_id = $1`,
        [paidBId],
      );
      expect(rows).toHaveLength(0);
    });

    it('…e o familiar B baixa a MESMA parcela normalmente', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables/${paidBId}/receipt`)
        .set('Authorization', `Bearer ${relativeBToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    }, 120_000);

    it('parcela inexistente → 404', () =>
      request(app.getHttpServer())
        .get(`${BASE}/relatives/me/receivables/00000000-0000-4000-8000-000000000000/receipt`)
        .set('Authorization', `Bearer ${relativeAToken}`)
        .expect(404));
  });
});
