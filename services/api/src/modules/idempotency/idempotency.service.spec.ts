import { Repository } from 'typeorm';
import { IdempotencyKey, IdempotencyStatus } from './idempotency-key.entity';
import {
  IDEMPOTENCY_RETENTION_DAYS,
  IdempotencyScope,
  IdempotencyService,
} from './idempotency.service';

const scope: IdempotencyScope = {
  key: '11111111-1111-1111-1111-111111111111',
  userId: 'u1',
  httpMethod: 'POST',
  path: '/api/v1/storerooms/movements',
};

/**
 * Repositório em memória com o unique `(key, userId, httpMethod, path)` — é o
 * comportamento do banco que o serviço depende, então o fake precisa reproduzi-lo.
 */
function makeRepo() {
  const rows: IdempotencyKey[] = [];
  let seq = 0;
  const sameScope = (row: IdempotencyKey, s: IdempotencyScope) =>
    row.key === s.key &&
    row.userId === s.userId &&
    row.httpMethod === s.httpMethod &&
    row.path === s.path;

  return {
    rows,
    create: jest.fn((data: Partial<IdempotencyKey>) => ({ ...data }) as IdempotencyKey),
    save: jest.fn(async (row: IdempotencyKey) => {
      if (rows.some((r) => sameScope(r, row))) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      const saved = { ...row, id: `id-${++seq}`, createdAt: new Date() } as IdempotencyKey;
      rows.push(saved);
      return saved;
    }),
    findOne: jest.fn(async ({ where }: { where: IdempotencyScope }) => {
      return rows.find((r) => sameScope(r, where)) ?? null;
    }),
    update: jest.fn(async (id: string, patch: Partial<IdempotencyKey>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
    delete: jest.fn(async (criteria: string | { createdAt: unknown }) => {
      if (typeof criteria === 'string') {
        const i = rows.findIndex((r) => r.id === criteria);
        if (i >= 0) rows.splice(i, 1);
        return { affected: i >= 0 ? 1 : 0 };
      }
      // LessThan(cutoff) — o fake lê o valor interno do operador do TypeORM.
      const cutoff = (criteria.createdAt as { value: Date }).value;
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].createdAt < cutoff) rows.splice(i, 1);
      }
      return { affected: before - rows.length };
    }),
  };
}

type RepoMock = ReturnType<typeof makeRepo>;

function makeService(repo: RepoMock = makeRepo()) {
  return {
    service: new IdempotencyService(repo as unknown as Repository<IdempotencyKey>),
    repo,
  };
}

const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe('IdempotencyService', () => {
  describe('reserve', () => {
    it('cria a reserva como IN_PROGRESS', async () => {
      const { service, repo } = makeService();
      const reservation = await service.reserve(scope);

      expect(reservation).not.toBeNull();
      expect(reservation!.status).toBe(IdempotencyStatus.IN_PROGRESS);
      expect(repo.rows).toHaveLength(1);
    });

    it('devolve null quando a mesma tupla viola o unique', async () => {
      const { service, repo } = makeService();
      await service.reserve(scope);

      expect(await service.reserve(scope)).toBeNull();
      expect(repo.rows).toHaveLength(1);
    });

    it('reconhece o unique violation embrulhado pelo TypeORM (driverError)', async () => {
      const repo = makeRepo();
      repo.save.mockRejectedValueOnce({ driverError: { code: '23505' } });
      const { service } = makeService(repo);

      expect(await service.reserve(scope)).toBeNull();
    });

    it('repropaga erro que não é violação de unique', async () => {
      const repo = makeRepo();
      repo.save.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: '08006' }));
      const { service } = makeService(repo);

      await expect(service.reserve(scope)).rejects.toThrow('boom');
    });

    it('não colide com a mesma chave de outro usuário nem em outra rota', async () => {
      const { service, repo } = makeService();
      await service.reserve(scope);

      expect(await service.reserve({ ...scope, userId: 'u2' })).not.toBeNull();
      expect(await service.reserve({ ...scope, path: '/api/v1/incidents' })).not.toBeNull();
      expect(await service.reserve({ ...scope, httpMethod: 'PATCH' })).not.toBeNull();
      expect(repo.rows).toHaveLength(4);
    });
  });

  describe('findByScope', () => {
    it('encontra a reserva pela tupla e devolve null para tupla desconhecida', async () => {
      const { service } = makeService();
      await service.reserve(scope);

      expect(await service.findByScope(scope)).not.toBeNull();
      expect(await service.findByScope({ ...scope, userId: 'outro' })).toBeNull();
    });
  });

  describe('complete', () => {
    it('grava status, body e marca COMPLETED', async () => {
      const { service, repo } = makeService();
      const reservation = await service.reserve(scope);

      await service.complete(reservation!.id, 201, { id: 'mov-1' });

      const row = repo.rows[0];
      expect(row.status).toBe(IdempotencyStatus.COMPLETED);
      expect(row.responseStatus).toBe(201);
      expect(row.responseBody).toEqual({ id: 'mov-1' });
      expect(row.completedAt).toBeInstanceOf(Date);
    });

    it('normaliza body undefined para null (coluna jsonb)', async () => {
      const { service, repo } = makeService();
      const reservation = await service.reserve(scope);

      await service.complete(reservation!.id, 204, undefined);

      expect(repo.rows[0].responseBody).toBeNull();
    });

    it('é best-effort: falha de banco não derruba a escrita já efetivada', async () => {
      const repo = makeRepo();
      repo.update.mockRejectedValueOnce(new Error('db down'));
      const { service } = makeService(repo);

      await expect(service.complete('id-1', 201, {})).resolves.toBeUndefined();
    });
  });

  describe('release', () => {
    it('apaga a reserva para o reenvio poder tentar de novo', async () => {
      const { service, repo } = makeService();
      const reservation = await service.reserve(scope);

      await service.release(reservation!.id);

      expect(repo.rows).toHaveLength(0);
      expect(await service.reserve(scope)).not.toBeNull();
    });

    it('é best-effort: falha ao liberar não estoura', async () => {
      const repo = makeRepo();
      repo.delete.mockRejectedValueOnce(new Error('db down'));
      const { service } = makeService(repo);

      await expect(service.release('id-1')).resolves.toBeUndefined();
    });
  });

  describe('purgeExpired', () => {
    it('apaga o que passou da janela e preserva o que está dentro', async () => {
      const { service, repo } = makeService();
      await service.reserve(scope);
      await service.reserve({ ...scope, key: 'k-old' });
      repo.rows[1].createdAt = new Date(Date.now() - days(IDEMPOTENCY_RETENTION_DAYS + 1));

      const { removed } = await service.purgeExpired();

      expect(removed).toBe(1);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].key).toBe(scope.key);
    });

    it('devolve 0 quando o driver não informa a contagem', async () => {
      const repo = makeRepo();
      repo.delete.mockResolvedValueOnce({ affected: undefined } as never);
      const { service } = makeService(repo);

      expect(await service.purgeExpired()).toEqual({ removed: 0 });
    });
  });

  describe('scheduledPurge', () => {
    it('roda a purga e loga quando removeu algo', async () => {
      const { service, repo } = makeService();
      await service.reserve(scope);
      repo.rows[0].createdAt = new Date(Date.now() - days(IDEMPOTENCY_RETENTION_DAYS + 1));
      const log = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);

      await service.scheduledPurge();

      expect(repo.rows).toHaveLength(0);
      expect(log).toHaveBeenCalled();
    });

    it('não loga quando nada expirou', async () => {
      const { service } = makeService();
      await service.reserve(scope);
      const log = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);

      await service.scheduledPurge();

      expect(log).not.toHaveBeenCalled();
    });
  });
});
