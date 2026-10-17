import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { FamilyInvestment, todayInSaoPaulo } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 199 — auditoria de ações dos usuários.
 *
 * Fixtures próprias (filho, servo, ministério, regra), limpeza por id e seed só
 * leitura. Os eventos de auditoria gerados aqui são apagados no fim POR ID
 * (acumulados durante a suíte) — nunca por categoria, e não há rota de exclusão.
 */
interface AuditItem {
  id: string;
  action: string;
  outcome: string | null;
  reason: string | null;
  userId: string | null;
  userName: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  houseId: string | null;
  previousHouseId: string | null;
  parentId: string | null;
  changedFields: string[] | null;
  hasDetail: boolean;
  createdAt: string;
}

describe('Audit trail (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  let otherHouseId: string;
  let adminUserId: string;

  const tag = `Audit${Date.now()}`;
  const residentIds: string[] = [];
  const staffIds: string[] = [];
  const ministryIds: string[] = [];
  const auditIds = new Set<string>();

  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(t: T) => t.set('Authorization', `Bearer ${adminToken}`);

  /** Lista eventos (ADMIN) e acumula os ids para a limpeza final. */
  async function events(query: Record<string, string | number>): Promise<AuditItem[]> {
    const res = await asAdmin(http().get(`${BASE}/audit`).query(query)).expect(200);
    for (const item of res.body.items as AuditItem[]) auditIds.add(item.id);
    return res.body.items;
  }

  /** O login grava no `finish` da resposta: espera curta até o evento aparecer. */
  async function waitFor(query: Record<string, string>, predicate: (i: AuditItem) => boolean) {
    for (let i = 0; i < 20; i++) {
      const found = (await events(query)).find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`evento não encontrado: ${JSON.stringify(query)}`);
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    const [admin] = await dataSource.query(`SELECT id FROM users WHERE email = $1`, ['admin@fonte.com']);
    adminUserId = admin.id;
    const houses = await asAdmin(http().get(`${BASE}/houses`)).expect(200);
    otherHouseId = houses.body.find((h: { id: string }) => h.id !== houseId)?.id ?? houseId;
  });

  afterAll(async () => {
    for (const id of ministryIds) {
      await asAdmin(http().delete(`${BASE}/ministries/${id}`));
    }
    for (const id of residentIds) {
      await asAdmin(http().delete(`${BASE}/residents/${id}`));
    }
    for (const id of staffIds) {
      await asAdmin(http().delete(`${BASE}/staff/${id}`));
    }
    // Eventos da própria suíte, inclusive os gerados pela limpeza acima.
    const ids = [...residentIds, ...staffIds, ...ministryIds];
    const cleanupRows = await dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM audit_logs WHERE target_id = ANY($1) OR parent_id = ANY($1)`,
      [ids],
    );
    for (const row of cleanupRows) auditIds.add(row.id);
    if (auditIds.size) {
      await dataSource.query(`DELETE FROM audit_logs WHERE id = ANY($1::uuid[])`, [[...auditIds]]);
    }
    await app.close();
  });

  describe('permissões', () => {
    it('anônimo → 401', () => http().get(`${BASE}/audit`).expect(401));
    it('COORDINATOR → 403', () =>
      http().get(`${BASE}/audit`).set('Authorization', `Bearer ${coordToken}`).expect(403));
    it('SERVANT → 403 também no detalhe', () =>
      http()
        .get(`${BASE}/audit/events/${randomUUID()}`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));
    it('ADMIN → 200 com { items, nextCursor }', async () => {
      const res = await asAdmin(http().get(`${BASE}/audit`)).expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body).toHaveProperty('nextCursor');
    });
  });

  describe('validação da consulta', () => {
    it.each([
      [{ limit: 101 }],
      [{ limit: 0 }],
      [{ from: 'ontem' }],
      [{ cursor: 'lixo' }],
      [{ desconhecido: 'x' }],
      [{ from: '2026-10-10T00:00:00Z', to: '2026-10-01T00:00:00Z' }],
    ])('%j → 400', async (query) => {
      await asAdmin(http().get(`${BASE}/audit`).query(query)).expect(400);
    });

    it('detalhe inexistente → 404; id inválido → 400', async () => {
      await asAdmin(http().get(`${BASE}/audit/events/${randomUUID()}`)).expect(404);
      await asAdmin(http().get(`${BASE}/audit/events/nao-uuid`)).expect(400);
    });
  });

  describe('login', () => {
    it('sucesso e falha: um evento por tentativa, sem credenciais e sem autor na falha', async () => {
      const identifier = `nao-existe-${tag}@fonte.com`;
      await http().post(`${BASE}/auth/login`).send({ identifier, password: 'senha-errada-x' }).expect(401);
      await http().post(`${BASE}/auth/login`).send({ identifier: 'admin@fonte.com', password: 'admin123' }).expect(200);
      await http().post(`${BASE}/auth/login`).send({ identifier: 'admin@fonte.com' }).expect(400);

      const failure = await waitFor(
        { action: 'auth.login', outcome: 'FAILURE' },
        (i) => i.reason === 'UNKNOWN_IDENTIFIER',
      );
      expect(failure.userId).toBeNull();
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${failure.id}`)).expect(200);
      expect(detail.body.context.identifier).toBe('n***@fonte.com');
      expect(JSON.stringify(detail.body)).not.toMatch(/senha-errada|nao-existe-Audit/);

      await waitFor({ action: 'auth.login', outcome: 'FAILURE' }, (i) => i.reason === 'INVALID_INPUT');
      const success = await waitFor(
        { action: 'auth.login', outcome: 'SUCCESS', userId: adminUserId },
        () => true,
      );
      expect(success).toMatchObject({ userId: adminUserId, targetType: 'user' });
    });
  });

  describe('ficha do filho, contribuições, anexos e documentos', () => {
    let residentId: string;
    let receivableId: string;

    beforeAll(async () => {
      const res = await http()
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          name: `Filho ${tag}`,
          houseId,
          cpf: '123.456.789-00',
          entryDate: todayInSaoPaulo(),
          familyInvestment: FamilyInvestment.PAYMENT_700,
          contributionDueDay: 10,
        })
        .expect(201);
      residentId = res.body.id;
      residentIds.push(residentId);
      const list = await asAdmin(http().get(`${BASE}/residents/${residentId}/receivables`)).expect(200);
      receivableId = list.body[0].id;
    });

    it('criação aparece com autor, casa e CPF mascarado', async () => {
      const [created] = await events({ action: 'resident.create', targetId: residentId });
      expect(created).toMatchObject({ targetName: `Filho ${tag}`, houseId, outcome: 'SUCCESS' });
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${created.id}`)).expect(200);
      const cpf = detail.body.changes.find((c: { field: string }) => c.field === 'cpf');
      expect(cpf).toEqual({ field: 'cpf', before: null, after: '***00', redacted: true });
      expect(detail.body.path).toBe('/api/v1/residents');
    });

    it('edição com transferência: antes/depois e filtro por casa acha os dois lados', async () => {
      await asAdmin(
        http().patch(`${BASE}/residents/${residentId}`).send({ name: `Filho ${tag} B`, houseId: otherHouseId }),
      ).expect(200);
      const [updated] = await events({ action: 'resident.update', targetId: residentId });
      expect(updated).toMatchObject({ houseId: otherHouseId, previousHouseId: houseId, userId: adminUserId });
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${updated.id}`)).expect(200);
      expect(detail.body.changes).toEqual(
        expect.arrayContaining([
          { field: 'name', before: `Filho ${tag}`, after: `Filho ${tag} B`, redacted: false },
          { field: 'houseId', before: houseId, after: otherHouseId, redacted: false },
        ]),
      );
      for (const h of [houseId, otherHouseId]) {
        const byHouse = await events({ houseId: h, targetId: residentId, action: 'resident.update' });
        expect(byHouse.map((e) => e.id)).toContain(updated.id);
      }
      // volta para a casa original (fixture limpa)
      await asAdmin(http().patch(`${BASE}/residents/${residentId}`).send({ houseId })).expect(200);
    });

    it('replay com a mesma Idempotency-Key gera um único evento', async () => {
      const key = randomUUID();
      const send = () =>
        asAdmin(
          http()
            .patch(`${BASE}/residents/${residentId}`)
            .set('Idempotency-Key', key)
            .send({ occupation: `Pedreiro ${tag}` }),
        ).expect(200);
      await send();
      await send();
      const found = (await events({ action: 'resident.update', targetId: residentId })).filter((e) =>
        e.changedFields?.includes('occupation'),
      );
      expect(found).toHaveLength(1);
    });

    it('isenção, pagamento e reabertura de parcela (filho como recurso principal)', async () => {
      await asAdmin(
        http().post(`${BASE}/residents/${residentId}/receivables/${receivableId}/payment`).field('paidAt', todayInSaoPaulo()).field('paymentMethod', 'PIX'),
      ).expect(201);
      await asAdmin(http().post(`${BASE}/residents/${residentId}/receivables/${receivableId}/reopen`)).expect(201);
      await asAdmin(http().patch(`${BASE}/residents/${residentId}/contribution-exempt`).send({ exempt: true })).expect(200);
      const byResident = await events({ targetId: residentId });
      const actions = byResident.map((e) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'resident.receivable.payment',
          'resident.receivable.reopen',
          'resident.contribution_exempt.update',
        ]),
      );
      const payment = byResident.find((e) => e.action === 'resident.receivable.payment')!;
      expect(payment).toMatchObject({ targetId: receivableId, parentId: residentId, houseId });
    });

    it('produtos recebidos: declaração e remoção com parcela, filho e casa', async () => {
      const declared = await asAdmin(
        http()
          .post(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions`)
          .send({ lines: [{ description: `Feijão ${tag}`, quantity: 2, unit: 'kg' }] }),
      ).expect(201);
      const contributionId = declared.body[0].id;
      await asAdmin(
        http().delete(`${BASE}/residents/${residentId}/receivables/${receivableId}/product-contributions/${contributionId}`),
      ).expect(204);
      const [declare] = await events({ action: 'resident.product_contribution.declare', targetId: residentId });
      expect(declare).toMatchObject({ targetId: contributionId, parentId: residentId, houseId });
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${declare.id}`)).expect(200);
      expect(detail.body.changes).toEqual(
        expect.arrayContaining([
          { field: 'receivableId', before: null, after: receivableId, redacted: false },
          { field: 'quantity', before: null, after: 2, redacted: false },
        ]),
      );
      const [removed] = await events({ action: 'resident.product_contribution.remove', targetId: contributionId });
      expect(removed.parentId).toBe(residentId);
    });

    it('anexo adicionado e removido sem nome do arquivo no log', async () => {
      const added = await asAdmin(
        http().post(`${BASE}/residents/${residentId}/attachments`).attach('file', Buffer.from('conteudo'), `RG ${tag}.txt`),
      ).expect(201);
      await asAdmin(http().delete(`${BASE}/residents/${residentId}/attachments/${added.body.id}`)).expect(204);
      const list = await events({ targetType: 'resident-attachment', targetId: added.body.id });
      expect(list.map((e) => e.action).sort()).toEqual(['resident.attachment.add', 'resident.attachment.remove']);
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${list[0].id}`)).expect(200);
      expect(JSON.stringify(detail.body)).not.toContain(`RG ${tag}`);
    });

    it('documento gerado: ids do template, formato e quantidade; sem diff fictício', async () => {
      const tpl = await asAdmin(
        http().post(`${BASE}/document-templates`).send({ name: `Termo ${tag}`, content: '<p>{{name}}</p>' }),
      ).expect(201);
      try {
        await asAdmin(http().get(`${BASE}/residents/${residentId}/documents/${tpl.body.id}/render`)).expect(200);
        // Rotas com `@Res()` enviam o corpo antes do interceptor terminar: espera curta.
        const rendered = await waitFor({ action: 'resident.document.render', targetId: residentId }, () => true);
        const detail = await asAdmin(http().get(`${BASE}/audit/events/${rendered.id}`)).expect(200);
        expect(detail.body).toMatchObject({
          changes: null,
          context: { templateIds: [tpl.body.id], format: 'html', count: 1 },
          houseId,
        });
      } finally {
        await asAdmin(http().delete(`${BASE}/document-templates/${tpl.body.id}`));
      }
    });
  });

  describe('servos', () => {
    it('criação, edição (vínculo com casa) e remoção', async () => {
      const created = await asAdmin(
        http()
          .post(`${BASE}/staff`)
          .send({ name: `Servo ${tag}`, email: `servo-${tag}@fonte.com`, password: 'senha123', role: 'SERVANT', houseId }),
      ).expect(201);
      const staffId = created.body.id;
      staffIds.push(staffId);
      await asAdmin(http().patch(`${BASE}/staff/${staffId}`).send({ houseId: otherHouseId })).expect(200);
      const list = await events({ targetType: 'staff', targetId: staffId });
      expect(list.map((e) => e.action).sort()).toEqual(['staff.create', 'staff.update']);
      const update = list.find((e) => e.action === 'staff.update')!;
      expect(update).toMatchObject({ houseId: otherHouseId, previousHouseId: houseId, changedFields: ['houseId'] });
      const detail = await asAdmin(
        http().get(`${BASE}/audit/events/${list.find((e) => e.action === 'staff.create')!.id}`),
      ).expect(200);
      expect(JSON.stringify(detail.body)).not.toMatch(/senha123|passwordHash/);
    });
  });

  describe('casas e ministérios', () => {
    it('regra da casa e ministério com entrada/saída de filho', async () => {
      const rule = await asAdmin(
        http().post(`${BASE}/houses/${houseId}/rules`).send({ title: `Regra ${tag}`, content: 'x' }),
      ).expect(201);
      await asAdmin(http().delete(`${BASE}/houses/${houseId}/rules/${rule.body.id}`)).expect(204);

      const resident = await http()
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: `Ministro ${tag}`, houseId, status: 'ACTIVE', entryDate: todayInSaoPaulo() })
        .expect(201);
      residentIds.push(resident.body.id);
      const ministry = await asAdmin(
        http().post(`${BASE}/houses/${houseId}/ministries`).send({ name: `Ministério ${tag}` }),
      ).expect(201);
      ministryIds.push(ministry.body.id);
      await asAdmin(
        http().post(`${BASE}/ministries/${ministry.body.id}/residents`).send({ residentId: resident.body.id }),
      ).expect(204);
      await asAdmin(http().delete(`${BASE}/ministries/${ministry.body.id}/residents/${resident.body.id}`)).expect(204);

      const ruleEvents = await events({ targetId: rule.body.id });
      expect(ruleEvents.map((e) => e.action).sort()).toEqual(['house.rule.create', 'house.rule.delete']);
      expect(ruleEvents[0]).toMatchObject({ houseId, parentId: houseId });

      const links = await events({ targetId: ministry.body.id });
      const actions = links.map((e) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining(['ministry.create', 'ministry.resident.add', 'ministry.resident.remove']),
      );
      const add = links.find((e) => e.action === 'ministry.resident.add')!;
      expect(add).toMatchObject({ targetId: resident.body.id, targetType: 'resident', houseId });
    });
  });

  describe('contagem', () => {
    it('inclusão pelo coordenador e rejeição pelo ADMIN', async () => {
      const added = await http()
        .post(`${BASE}/census/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: `Contagem ${tag}`, houseId, entryDate: todayInSaoPaulo() })
        .expect(201);
      residentIds.push(added.body.id);
      await asAdmin(http().patch(`${BASE}/census/residents/${added.body.id}/reject`)).expect(200);
      const list = await events({ targetId: added.body.id });
      expect(list.map((e) => e.action).sort()).toEqual(['census.reject', 'census.resident.add']);
      const reject = list.find((e) => e.action === 'census.reject')!;
      expect(reject).toMatchObject({ houseId, userId: adminUserId, changedFields: ['status'] });
    });
  });

  describe('paginação e eventos legados', () => {
    const action = `e2e.cursor.${Date.now()}`;
    const legacyIds: string[] = [];

    beforeAll(async () => {
      // 3 eventos com o MESMO instante (cursor precisa desempatar por id) + 1 legado.
      const at = new Date().toISOString().replace('T', ' ').replace('Z', '');
      for (let i = 0; i < 3; i++) {
        const [row] = await dataSource.query(
          `INSERT INTO audit_logs (action, created_at, outcome, changes) VALUES ($1, $2::timestamp, 'SUCCESS', '[]'::jsonb) RETURNING id`,
          [action, at],
        );
        auditIds.add(row.id);
      }
      const [legacy] = await dataSource.query(
        `INSERT INTO audit_logs (action, target_type, target_id) VALUES ($1, 'resident', $2) RETURNING id`,
        [`${action}.legacy`, randomUUID()],
      );
      legacyIds.push(legacy.id);
      auditIds.add(legacy.id);
    });

    it('cursor estável com datas iguais percorre tudo sem repetir', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query: Record<string, string | number> = { action, limit: 1 };
        if (cursor) query.cursor = cursor;
        const res = await asAdmin(http().get(`${BASE}/audit`).query(query)).expect(200);
        seen.push(...res.body.items.map((i: AuditItem) => i.id));
        cursor = res.body.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
      expect([...seen].sort().reverse()).toEqual(seen); // desempate por id DESC
    });

    it('evento legado continua visível com detalhe indisponível', async () => {
      const [legacy] = await events({ action: `${action}.legacy` });
      expect(legacy).toMatchObject({ id: legacyIds[0], hasDetail: false, outcome: null });
      const detail = await asAdmin(http().get(`${BASE}/audit/events/${legacy.id}`)).expect(200);
      expect(detail.body).toMatchObject({ changes: null, context: null });
    });
  });
});
