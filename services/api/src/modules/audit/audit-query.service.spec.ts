import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AUDIT_DEFAULT_LIMIT,
  AuditQueryService,
  decodeCursor,
  encodeCursor,
} from './audit-query.service';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function row(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: UUID(n),
    cursor_at: `2026-10-17T12:00:00.00000${n % 10}`,
    created_iso: '2026-10-17T12:00:00.000Z',
    action: 'resident.update',
    outcome: 'SUCCESS',
    reason: null,
    user_id: UUID(900),
    role: 'ADMIN',
    target_type: 'resident',
    target_id: UUID(100),
    house_id: UUID(200),
    previous_house_id: null,
    parent_type: null,
    parent_id: null,
    changed_fields: ['name'],
    changes: [{ field: 'name', before: 'A', after: 'B', redacted: false }],
    context: null,
    http_method: 'PATCH',
    path: '/api/v1/residents/x',
    ip_address: '1.1.1.1',
    correlation_id: 'req-1',
    ...overrides,
  };
}

function makeService(rows: unknown[]) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]]>(async (sql: string) => {
    if (sql.includes('FROM audit_logs')) return rows;
    if (sql.includes('FROM users')) return [{ id: UUID(900), name: 'Admin Fonte' }, { id: UUID(901), name: null }];
    if (sql.includes('FROM residents')) return [{ id: UUID(100), name: 'Filho Teste' }];
    if (sql.includes('FROM houses')) return [{ id: UUID(200), name: 'Casa A' }, { id: UUID(201), name: 'Casa B' }];
    return [];
  });
  return { service: new AuditQueryService({ query } as never), query };
}

describe('AuditQueryService.list', () => {
  const NOW = new Date('2026-10-17T15:00:00.000Z');

  it('período padrão de 30 dias, limite padrão e nomes resolvidos', async () => {
    const { service, query } = makeService([row(1)]);
    const page = await service.list({}, NOW);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ORDER BY a.created_at DESC, a.id DESC');
    expect(params[0]).toBe('2026-09-17T15:00:00.000Z');
    expect(params[1]).toBe('2026-10-17T15:00:00.000Z');
    expect(params[params.length - 1]).toBe(AUDIT_DEFAULT_LIMIT + 1);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      id: UUID(1),
      createdAt: '2026-10-17T12:00:00.000Z',
      userName: 'Admin Fonte',
      targetName: 'Filho Teste',
      houseName: 'Casa A',
      changedFields: ['name'],
      hasDetail: true,
    });
  });

  it('filtros combinados viram parâmetros (casa nos dois lados; recurso como alvo ou principal)', async () => {
    const { service, query } = makeService([]);
    await service.list(
      {
        userId: UUID(900),
        houseId: UUID(200),
        action: 'resident.update',
        targetType: 'resident',
        targetId: UUID(100),
        outcome: 'SUCCESS' as never,
        limit: 10,
      },
      NOW,
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('a.user_id = $3::uuid');
    expect(sql).toContain('(a.house_id = $4::uuid OR a.previous_house_id = $4::uuid)');
    expect(sql).toContain('a.action = $5');
    expect(sql).toContain('a.target_type = $6');
    expect(sql).toContain('(a.target_id = $7 OR a.parent_id = $7)');
    expect(sql).toContain('a.outcome = $8');
    expect(params).toEqual([
      expect.any(String),
      expect.any(String),
      UUID(900),
      UUID(200),
      'resident.update',
      'resident',
      UUID(100),
      'SUCCESS',
      11,
    ]);
  });

  it('página cheia devolve cursor do último item; cursor vira comparação estável', async () => {
    const rows = [row(1), row(2), row(3)];
    const { service, query } = makeService(rows);
    const page = await service.list({ limit: 2 }, NOW);
    expect(page.items.map((i) => i.id)).toEqual([UUID(1), UUID(2)]);
    expect(decodeCursor(page.nextCursor!)).toEqual({ at: rows[1].cursor_at, id: UUID(2) });

    query.mockClear();
    await service.list({ limit: 2, cursor: page.nextCursor! }, NOW);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('(a.created_at, a.id) < ($3::timestamp, $4::uuid)');
    expect(params.slice(2, 4)).toEqual([rows[1].cursor_at, UUID(2)]);
  });

  it('evento legado (sem diff/contexto) e transferência com as duas casas', async () => {
    const { service } = makeService([
      row(1, { changes: null, changed_fields: null, outcome: null, user_id: null }),
      row(2, { house_id: UUID(201), previous_house_id: UUID(200), target_type: 'house-photo' }),
    ]);
    const { items } = await service.list({}, NOW);
    expect(items[0]).toMatchObject({ hasDetail: false, userName: null, outcome: null });
    expect(items[1]).toMatchObject({ houseName: 'Casa B', previousHouseName: 'Casa A', targetName: null });
  });

  it('período invertido → 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.list({ from: '2026-10-10T00:00:00Z', to: '2026-10-01T00:00:00Z' }, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cursor inválido → 400', async () => {
    const { service } = makeService([]);
    await expect(service.list({ cursor: 'lixo' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
    const forged = Buffer.from('2026-10-17T12:00:00.000000|nao-uuid').toString('base64url');
    await expect(service.list({ cursor: forged }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuditQueryService.findOne', () => {
  it('devolve detalhe com diffs e contexto', async () => {
    const { service } = makeService([row(1, { context: { a: 1 } })]);
    await expect(service.findOne(UUID(1))).resolves.toMatchObject({
      id: UUID(1),
      changes: [{ field: 'name', before: 'A', after: 'B', redacted: false }],
      context: { a: 1 },
      httpMethod: 'PATCH',
      path: '/api/v1/residents/x',
      ipAddress: '1.1.1.1',
      correlationId: 'req-1',
    });
  });

  it('ausente → 404', async () => {
    const { service } = makeService([]);
    await expect(service.findOne(UUID(1))).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('cursor', () => {
  it('ida e volta', () => {
    const c = encodeCursor('2026-10-17T12:00:00.123456', UUID(5));
    expect(decodeCursor(c)).toEqual({ at: '2026-10-17T12:00:00.123456', id: UUID(5) });
  });
});
