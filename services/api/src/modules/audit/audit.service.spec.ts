import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LoginFailureReason } from '@fonte/types';
import {
  AuditService,
  defaultScope,
  describeAuditError,
  loadById,
  loginReasonFor,
} from './audit.service';
import { AuditLog } from './audit-log.entity';
import { AuditRequestContext, auditContext } from './audit-context';
import { createAuditHarness, repoMap } from './testing/audit-harness.testkit-spec';
import type { AuditFieldMap } from './audit-diff';

class Thing {}

const FIELDS: AuditFieldMap = { name: 'plain', cpf: 'masked', health: 'redacted', houseId: 'plain' };

function ctx(overrides: Partial<AuditRequestContext> = {}): AuditRequestContext {
  return {
    requestId: 'req-1',
    userId: 'user-1',
    role: 'ADMIN',
    ipAddress: '10.0.0.1',
    httpMethod: 'PATCH',
    path: '/api/v1/things/t1',
    ...overrides,
  };
}

/** Repositório em memória do alvo: `findOne` devolve o estado atual. */
function statefulRepo(initial: Record<string, unknown> | null) {
  let state = initial ? { ...initial } : null;
  return {
    findOne: jest.fn(async () => (state ? { ...state } : null)),
    set(next: Record<string, unknown> | null) {
      state = next ? { ...next } : null;
    },
  };
}

describe('AuditService.track', () => {
  it('edição: grava só os campos alterados, com autor/rota do contexto e casa do estado novo', async () => {
    const repo = statefulRepo({ id: 't1', name: 'Ana', cpf: '12345678900', health: 'x', houseId: 'h1' });
    const h = createAuditHarness(repoMap([[Thing, repo]]));

    await auditContext.run(ctx(), () =>
      h.audit.track({
        action: 'thing.update',
        targetType: 'thing',
        targetId: 't1',
        fields: FIELDS,
        load: loadById(Thing),
        lockTable: 'things',
        write: async () => repo.set({ id: 't1', name: 'Bia', cpf: '12345678911', health: 'y', houseId: 'h1' }),
      }),
    );

    expect(h.query).toHaveBeenCalledWith('SELECT 1 FROM "things" WHERE id = $1 FOR UPDATE', ['t1']);
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0]).toMatchObject({
      action: 'thing.update',
      targetType: 'thing',
      targetId: 't1',
      userId: 'user-1',
      role: 'ADMIN',
      ipAddress: '10.0.0.1',
      httpMethod: 'PATCH',
      path: '/api/v1/things/t1',
      outcome: 'SUCCESS',
      houseId: 'h1',
      previousHouseId: null,
      correlationId: 'req-1',
      changedFields: ['name', 'cpf', 'health'],
      changes: [
        { field: 'name', before: 'Ana', after: 'Bia', redacted: false },
        { field: 'cpf', before: '***00', after: '***11', redacted: true },
        { field: 'health', before: null, after: null, redacted: true },
      ],
    });
  });

  it('transferência guarda casa nova e anterior', async () => {
    const repo = statefulRepo({ id: 't1', name: 'Ana', houseId: 'h1' });
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    await h.audit.track({
      action: 'thing.update',
      targetType: 'thing',
      targetId: 't1',
      fields: FIELDS,
      load: loadById(Thing),
      write: async () => repo.set({ id: 't1', name: 'Ana', houseId: 'h2' }),
    });
    expect(h.inserted[0]).toMatchObject({ houseId: 'h2', previousHouseId: 'h1', changedFields: ['houseId'] });
  });

  it('criação: before null, id vindo do resultado; sem contexto o autor é nulo', async () => {
    const repo = statefulRepo(null);
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    const result = await h.audit.track({
      action: 'thing.create',
      targetType: 'thing',
      fields: FIELDS,
      load: loadById(Thing),
      resolveId: (r: { id: string }) => r.id,
      write: async () => {
        repo.set({ id: 'new', name: 'Ana', houseId: 'h1' });
        return { id: 'new' };
      },
    });
    expect(result).toEqual({ id: 'new' });
    expect(h.query).not.toHaveBeenCalled(); // sem lock na criação
    expect(h.inserted[0]).toMatchObject({
      targetId: 'new',
      userId: null,
      correlationId: null,
      changes: [
        { field: 'name', before: null, after: 'Ana', redacted: false },
        { field: 'houseId', before: null, after: 'h1', redacted: false },
      ],
    });
  });

  it('exclusão: after null e casa do estado anterior', async () => {
    const repo = statefulRepo({ id: 't1', name: 'Ana', houseId: 'h1' });
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    await h.audit.track({
      action: 'thing.delete',
      targetType: 'thing',
      targetId: 't1',
      fields: FIELDS,
      load: loadById(Thing),
      write: async () => repo.set(null),
    });
    expect(h.inserted[0]).toMatchObject({ houseId: 'h1', previousHouseId: null });
    expect((h.inserted[0].changes as Array<{ after: unknown }>).every((c) => c.after === null)).toBe(true);
  });

  it('edição sem mudança efetiva não gera evento', async () => {
    const repo = statefulRepo({ id: 't1', name: 'Ana', houseId: 'h1' });
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    await h.audit.track({
      action: 'thing.update',
      targetType: 'thing',
      targetId: 't1',
      fields: FIELDS,
      load: loadById(Thing),
      write: async () => undefined,
    });
    expect(h.inserted).toHaveLength(0);
  });

  it('falha ao gravar a auditoria propaga (a transação da alteração não confirma)', async () => {
    const repo = statefulRepo(null);
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    h.insert.mockRejectedValueOnce(new Error('audit down'));
    await expect(
      h.audit.track({
        action: 'thing.create',
        targetType: 'thing',
        fields: FIELDS,
        load: loadById(Thing),
        resolveId: () => 'new',
        write: async () => repo.set({ id: 'new', name: 'Ana' }),
      }),
    ).rejects.toThrow('audit down');
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('erro de negócio na escrita não grava evento de sucesso', async () => {
    const repo = statefulRepo({ id: 't1', name: 'Ana' });
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    await expect(
      h.audit.track({
        action: 'thing.update',
        targetType: 'thing',
        targetId: 't1',
        fields: FIELDS,
        load: loadById(Thing),
        write: async () => {
          throw new Error('regra');
        },
      }),
    ).rejects.toThrow('regra');
    expect(h.inserted).toHaveLength(0);
  });

  it('usa a transação externa quando recebida (sem abrir outra)', async () => {
    const repo = statefulRepo(null);
    const h = createAuditHarness(repoMap([[Thing, repo]]));
    await h.audit.track({
      action: 'thing.create',
      targetType: 'thing',
      fields: FIELDS,
      load: loadById(Thing),
      resolveId: () => 'new',
      manager: h.manager as never,
      write: async () => repo.set({ id: 'new', name: 'Ana' }),
    });
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.inserted).toHaveLength(1);
  });

  it('scope explícito sem casa resolve a casa pela ficha do recurso principal', async () => {
    const repo = statefulRepo(null);
    const query = jest.fn(async (sql: string) =>
      sql.includes('FROM residents') ? [{ house_id: 'h9' }] : [],
    );
    const h = createAuditHarness(repoMap([[Thing, repo]]), query);
    await h.audit.track({
      action: 'thing.create',
      targetType: 'attachment',
      fields: { url: 'file' },
      load: loadById(Thing),
      resolveId: () => 'a1',
      scope: () => ({ parentType: 'resident', parentId: 'r1' }),
      write: async () => repo.set({ id: 'a1', url: 'http://bucket/x.pdf' }),
    });
    expect(query).toHaveBeenCalledWith('SELECT house_id FROM residents WHERE id::text = $1', ['r1']);
    expect(h.inserted[0]).toMatchObject({
      houseId: 'h9',
      parentType: 'resident',
      parentId: 'r1',
      changes: [{ field: 'url', before: null, after: '[arquivo]', redacted: false }],
    });
  });
});

describe('AuditService.recordEvent / record', () => {
  it('grava evento aguardado com contexto, path sem query string e casa do filho alvo', async () => {
    const query = jest.fn().mockResolvedValue([{ house_id: 'h1' }]);
    const h = createAuditHarness(undefined, query);
    await auditContext.run(ctx({ path: '/api/v1/residents/r1/documents/t1/pdf' }), () =>
      h.audit.recordEvent({
        action: 'resident.document.pdf',
        targetType: 'resident',
        targetId: 'r1',
        path: '/api/v1/residents/r1/documents/t1/pdf?token=abc',
        context: { templateIds: ['t1'], format: 'pdf', count: 1 },
      }),
    );
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resident.document.pdf',
        houseId: 'h1',
        path: '/api/v1/residents/r1/documents/t1/pdf',
        changes: null,
        changedFields: null,
        context: { templateIds: ['t1'], format: 'pdf', count: 1 },
        userId: 'user-1',
      }),
    );
  });

  it('casa explícita (inclusive null) não consulta a ficha; alvo sem casa fica nulo', async () => {
    const h = createAuditHarness();
    await h.audit.record({ action: 'x', houseId: null, targetType: 'resident', targetId: 'r1' });
    await h.audit.record({ action: 'y', targetType: 'consent', targetId: 'c1' });
    expect(h.query).not.toHaveBeenCalled();
    expect(h.inserted.map((r) => r.houseId)).toEqual([null, null]);
  });

  it('falha não derruba a requisição: aviso sanitizado (sem mensagem do banco)', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const h = createAuditHarness();
    h.insert.mockRejectedValueOnce(Object.assign(new Error('valor secreto 123'), { code: '23505' }));
    await expect(h.audit.recordEvent({ action: 'resident.read' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('resident.read'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Error:23505'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('valor secreto'));
    warn.mockRestore();
  });
});

describe('AuditService.recordLogin', () => {
  it('sucesso: usuário resolvido pelo auth, identificador mascarado', async () => {
    const h = createAuditHarness();
    const c = ctx({ userId: null, role: null, path: '/api/v1/auth/login', httpMethod: 'POST' });
    c.login = { userId: 'u9', role: 'SERVANT', reason: null };
    await h.audit.recordLogin(c, 200, 'maria@fonte.com');
    expect(h.inserted[0]).toMatchObject({
      action: 'auth.login',
      outcome: 'SUCCESS',
      reason: null,
      userId: 'u9',
      role: 'SERVANT',
      targetType: 'user',
      targetId: 'u9',
      correlationId: 'req-1',
      context: { identifier: 'm***@fonte.com', status: 200 },
    });
  });

  it.each([
    [401, LoginFailureReason.INACTIVE_USER, LoginFailureReason.INACTIVE_USER],
    [401, null, LoginFailureReason.INVALID_CREDENTIALS],
    [400, null, LoginFailureReason.INVALID_INPUT],
    [429, null, LoginFailureReason.RATE_LIMITED],
    [500, null, LoginFailureReason.INTERNAL_ERROR],
  ])('falha %s (anotado %s) → %s, sem identidade atribuída', async (status, noted, expected) => {
    const h = createAuditHarness();
    const c = ctx({ userId: 'nao-usar', role: 'ADMIN' });
    c.login = { userId: null, role: null, reason: noted };
    await h.audit.recordLogin(c, status, '(11) 98765-4321');
    expect(h.inserted[0]).toMatchObject({
      outcome: 'FAILURE',
      reason: expected,
      userId: null,
      role: null,
      targetId: null,
      context: { identifier: '***4321', status },
    });
    expect(JSON.stringify(h.inserted[0])).not.toContain('98765');
  });

  it('falha do gravador: aviso sanitizado, nunca lança', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const h = createAuditHarness();
    h.insert.mockRejectedValueOnce(new Error('db down maria@fonte.com'));
    await expect(h.audit.recordLogin(ctx(), 401, 'maria@fonte.com')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requestId=req-1'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('maria'));
    warn.mockRestore();
  });
});

describe('AuditService.redactForResident', () => {
  it('zera valores dos diffs do titular (alvo ou principal) na transação recebida', async () => {
    const h = createAuditHarness();
    const manager = { query: jest.fn().mockResolvedValue([]) };
    await h.audit.redactForResident(manager as never, 'r1');
    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('UPDATE audit_logs SET changes');
    expect(sql).toContain('parent_type = $2 AND parent_id = $1');
    expect(params).toEqual(['r1', 'resident']);
  });
});

describe('AuditService.findByTarget (contrato legado)', () => {
  it('queries by target ordered by createdAt DESC, capped at 200', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const service = new AuditService({ find } as unknown as Repository<AuditLog>, {} as never);
    await service.findByTarget('resident', 'r1');
    expect(find).toHaveBeenCalledWith({
      where: { targetType: 'resident', targetId: 'r1' },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  });
});

describe('helpers', () => {
  it('defaultScope: snapshot sem casa não decide a casa', () => {
    expect(defaultScope({ url: 'x' }, null)).toEqual({});
    expect(defaultScope(null, { houseId: 'h1' })).toEqual({ houseId: 'h1', previousHouseId: null });
  });

  it('loginReasonFor mapeia status final', () => {
    expect(loginReasonFor(403, null)).toBe(LoginFailureReason.INVALID_INPUT);
    expect(loginReasonFor(401, LoginFailureReason.AMBIGUOUS_IDENTIFIER)).toBe(
      LoginFailureReason.AMBIGUOUS_IDENTIFIER,
    );
  });

  it('describeAuditError só expõe nome/código', () => {
    expect(describeAuditError(new TypeError('x'))).toBe('TypeError');
    expect(describeAuditError(null)).toBe('Error');
  });

  it('loadById devolve null quando não acha', async () => {
    const manager = { getRepository: () => ({ findOne: jest.fn().mockResolvedValue(undefined) }) };
    await expect(loadById(Thing)(manager as never, 'x')).resolves.toBeNull();
  });

  it('inTransaction reaproveita o manager recebido', async () => {
    const h = createAuditHarness();
    const work = jest.fn().mockResolvedValue('ok');
    await expect(h.audit.inTransaction(work, h.manager as never)).resolves.toBe('ok');
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });
});
