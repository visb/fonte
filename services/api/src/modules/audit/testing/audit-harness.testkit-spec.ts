import { AuditLog } from '../audit-log.entity';
import { AuditService } from '../audit.service';

/**
 * Harness de testes (story 199): um AuditService REAL sobre um manager fake.
 *
 * O `track` roda de verdade (lê antes, escreve, lê depois, calcula o diff) e as
 * linhas gravadas ficam em `inserted` — o spec do service afirma ação, alvo,
 * casa e diff sem mockar a auditoria. `resolve` mapeia a entidade para o mock
 * de repositório que o spec já tem (as escritas passam a usar o manager).
 *
 * Sufixo `-spec.ts`: fora do build (`tsconfig.build`) e não é suíte do jest.
 */
export function createAuditHarness(
  resolve: (entity: unknown) => unknown = () => undefined,
  query: jest.Mock = jest.fn().mockResolvedValue([]),
  extraManager: Record<string, unknown> = {},
) {
  const inserted: Array<Record<string, unknown>> = [];
  const insert = jest.fn(async (row: Record<string, unknown>) => {
    inserted.push(row);
  });
  const auditRepo = { insert };
  const manager = {
    getRepository: jest.fn((entity: unknown) => (entity === AuditLog ? auditRepo : resolve(entity))),
    query,
    ...extraManager,
  };
  const dataSource = {
    transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)),
    query,
  };
  const audit = new AuditService(auditRepo as never, dataSource as never);
  return { audit, manager, dataSource, inserted, insert, query };
}

/**
 * Repositório em memória de UMA tabela: `findOne({ where: { id } })` devolve a
 * linha atual, e as escritas a alteram — o "antes/depois" do track sai real.
 */
export function memoryRepo(rows: Array<Record<string, unknown>> = []) {
  const table = new Map<string, Record<string, unknown>>(rows.map((r) => [String(r.id), { ...r }]));
  let seq = 0;
  const repo = {
    table,
    create: jest.fn((v: Record<string, unknown>) => ({ ...v })),
    save: jest.fn(async (v: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const list = Array.isArray(v) ? v : [v];
      const saved = list.map((item) => {
        const row = { ...item, id: item.id ?? `new-${++seq}` };
        table.set(String(row.id), { ...(table.get(String(row.id)) ?? {}), ...row });
        return row;
      });
      return Array.isArray(v) ? saved : saved[0];
    }),
    count: jest.fn(async (opts?: { where?: Record<string, unknown> }) =>
      [...table.values()].filter((row) =>
        Object.entries(opts?.where ?? {}).every(([k, val]) => row[k] === val),
      ).length,
    ),
    find: jest.fn(async (opts?: { where?: Record<string, unknown> }) =>
      [...table.values()]
        .filter((row) => Object.entries(opts?.where ?? {}).every(([k, val]) => row[k] === val))
        .map((row) => ({ ...row })),
    ),
    findOne: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
      const where = opts?.where ?? {};
      for (const row of table.values()) {
        if (Object.entries(where).every(([k, val]) => row[k] === val)) return { ...row };
      }
      return null;
    }),
    update: jest.fn(async (criteria: unknown, patch: Record<string, unknown>) => {
      const ids =
        typeof criteria === 'string'
          ? [criteria]
          : [...table.values()]
              .filter((r) => Object.entries(criteria as object).every(([k, val]) => r[k] === val))
              .map((r) => String(r.id));
      for (const id of ids) if (table.has(id)) table.set(id, { ...table.get(id)!, ...patch });
      return { affected: ids.length };
    }),
    softDelete: jest.fn(async (id: string) => {
      table.delete(String(id));
      return { affected: 1 };
    }),
    delete: jest.fn(async (criteria: unknown) => {
      if (typeof criteria === 'string') table.delete(criteria);
      else
        for (const [id, r] of table)
          if (Object.entries(criteria as object).every(([k, val]) => r[k] === val)) table.delete(id);
      return { affected: 1 };
    }),
    softRemove: jest.fn(async (entity: { id: string }) => {
      table.delete(String(entity.id));
      return entity;
    }),
  };
  return repo;
}

/** Atalho: mapa entidade → mock de repositório. */
export function repoMap(entries: Array<[unknown, unknown]>): (entity: unknown) => unknown {
  const map = new Map(entries);
  return (entity) => map.get(entity);
}
