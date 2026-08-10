import { BadRequestException, ConflictException, ExecutionContext, HttpCode } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyStatus } from '../../modules/idempotency/idempotency-key.entity';
import {
  IdempotencyScope,
  IdempotencyService,
} from '../../modules/idempotency/idempotency.service';

const KEY = '11111111-1111-1111-1111-111111111111';
const PATH = '/api/v1/storerooms/movements';

interface Row extends IdempotencyScope {
  id: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: unknown;
}

/**
 * Fake do service com a semântica que o banco garante: `reserve` devolve null
 * quando a tupla `(key, userId, httpMethod, path)` já existe. É o contrato que o
 * interceptor consome — a violação de unique de verdade é coberta em
 * `idempotency.service.spec.ts` e no e2e.
 */
function makeIdempotencyService() {
  const rows = new Map<string, Row>();
  let seq = 0;
  const slot = (s: IdempotencyScope) => `${s.key}|${s.userId}|${s.httpMethod}|${s.path}`;

  return {
    rows,
    reserve: jest.fn(async (scope: IdempotencyScope): Promise<Row | null> => {
      if (rows.has(slot(scope))) return null;
      const row: Row = {
        ...scope,
        id: `id-${++seq}`,
        status: IdempotencyStatus.IN_PROGRESS,
        responseStatus: null,
        responseBody: null,
      };
      rows.set(slot(scope), row);
      return row;
    }),
    findByScope: jest.fn(async (scope: IdempotencyScope) => rows.get(slot(scope)) ?? null),
    complete: jest.fn(async (rowId: string, status: number, body: unknown) => {
      const row = [...rows.values()].find((r) => r.id === rowId);
      if (row) {
        row.status = IdempotencyStatus.COMPLETED;
        row.responseStatus = status;
        row.responseBody = body ?? null;
      }
    }),
    release: jest.fn(async (rowId: string) => {
      for (const [k, row] of rows) if (row.id === rowId) rows.delete(k);
    }),
  };
}

type ServiceMock = ReturnType<typeof makeIdempotencyService>;

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  method: 'POST',
  originalUrl: PATH,
  headers: { 'idempotency-key': KEY },
  user: { userId: 'u1' },
  ...overrides,
});

function makeContext(
  req: Record<string, unknown>,
  handler: (...args: unknown[]) => unknown,
  res: { status: jest.Mock },
) {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

interface RunOptions {
  service?: ServiceMock;
  decorated?: boolean;
  req?: Record<string, unknown>;
  handler?: (...args: unknown[]) => unknown;
  result?: unknown;
  error?: Error;
}

/** Executa o interceptor. Rejeita quando ele lança antes de chegar ao handler (400/409). */
async function run(options: RunOptions = {}) {
  const service = options.service ?? makeIdempotencyService();
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.decorated ?? true),
  } as unknown as Reflector;
  const interceptor = new IdempotencyInterceptor(
    reflector,
    service as unknown as IdempotencyService,
  );
  const next = {
    handle: jest
      .fn()
      .mockReturnValue(
        options.error ? throwError(() => options.error) : of(options.result ?? { id: 'mov-1' }),
      ),
  };
  const res = { status: jest.fn() };
  const context = makeContext(
    options.req ?? baseRequest(),
    options.handler ?? (() => undefined),
    res,
  );
  const result$ = await interceptor.intercept(context, next as never);
  return { service, next, res, result$ };
}

describe('IdempotencyInterceptor', () => {
  it('passa direto quando o handler não tem @Idempotent (nada gravado)', async () => {
    const { service, next, result$ } = await run({ decorated: false });

    await expect(firstValueFrom(result$)).resolves.toEqual({ id: 'mov-1' });
    expect(next.handle).toHaveBeenCalled();
    expect(service.reserve).not.toHaveBeenCalled();
  });

  it('com @Idempotent e sem header executa normal e não grava nada', async () => {
    const { service, next, result$ } = await run({ req: baseRequest({ headers: {} }) });

    await expect(firstValueFrom(result$)).resolves.toEqual({ id: 'mov-1' });
    expect(next.handle).toHaveBeenCalled();
    expect(service.reserve).not.toHaveBeenCalled();
  });

  it('rejeita header que não é UUID com 400', async () => {
    await expect(
      run({ req: baseRequest({ headers: { 'idempotency-key': 'nao-e-uuid' } }) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa o primeiro valor quando o header vem repetido', async () => {
    const { service, result$ } = await run({
      req: baseRequest({ headers: { 'idempotency-key': [KEY, 'lixo'] } }),
    });

    await firstValueFrom(result$);
    expect(service.reserve).toHaveBeenCalledWith(expect.objectContaining({ key: KEY }));
  });

  it('passa direto quando não há usuário autenticado (chave não teria escopo)', async () => {
    const { service, next, result$ } = await run({ req: baseRequest({ user: undefined }) });

    await firstValueFrom(result$);
    expect(next.handle).toHaveBeenCalled();
    expect(service.reserve).not.toHaveBeenCalled();
  });

  it('primeira chamada executa o handler e memoriza a resposta com o status do verbo', async () => {
    const { service, next, result$ } = await run();

    await expect(firstValueFrom(result$)).resolves.toEqual({ id: 'mov-1' });
    expect(next.handle).toHaveBeenCalledTimes(1);
    const row = [...service.rows.values()][0];
    expect(row.status).toBe(IdempotencyStatus.COMPLETED);
    expect(row.responseStatus).toBe(201);
    expect(row.responseBody).toEqual({ id: 'mov-1' });
  });

  it('memoriza o status de @HttpCode quando o handler define um explícito', async () => {
    class Ctrl {
      @HttpCode(202)
      handler() {
        return undefined;
      }
    }
    const { service, result$ } = await run({ handler: Ctrl.prototype.handler });

    await firstValueFrom(result$);
    expect([...service.rows.values()][0].responseStatus).toBe(202);
  });

  it('usa 200 como status memorizado em verbo que não é POST', async () => {
    const { service, result$ } = await run({ req: baseRequest({ method: 'PATCH' }) });

    await firstValueFrom(result$);
    expect([...service.rows.values()][0].responseStatus).toBe(200);
  });

  it('segunda chamada com a mesma chave não executa o handler e devolve a resposta original', async () => {
    const service = makeIdempotencyService();
    const first = await run({ service });
    await firstValueFrom(first.result$);

    const second = await run({ service, result: { id: 'mov-2' } });

    await expect(firstValueFrom(second.result$)).resolves.toEqual({ id: 'mov-1' });
    expect(second.next.handle).not.toHaveBeenCalled();
    expect(second.res.status).toHaveBeenCalledWith(201);
  });

  it('devolve 409 enquanto a requisição original ainda está em processamento', async () => {
    const service = makeIdempotencyService();
    await service.reserve({ key: KEY, userId: 'u1', httpMethod: 'POST', path: PATH });

    await expect(run({ service })).rejects.toBeInstanceOf(ConflictException);
  });

  it('devolve 409 quando a reserva some entre o insert e a leitura', async () => {
    const service = makeIdempotencyService();
    service.reserve.mockResolvedValueOnce(null);

    await expect(run({ service })).rejects.toBeInstanceOf(ConflictException);
  });

  it('libera a reserva quando o handler falha e repropaga o erro', async () => {
    const service = makeIdempotencyService();
    const failure = new Error('estoque insuficiente');
    const { result$ } = await run({ service, error: failure });

    await expect(firstValueFrom(result$)).rejects.toBe(failure);
    expect(service.release).toHaveBeenCalled();
    expect(service.rows.size).toBe(0);

    // o reenvio depois da correção volta a executar normalmente
    const retry = await run({ service, result: { id: 'mov-3' } });
    await expect(firstValueFrom(retry.result$)).resolves.toEqual({ id: 'mov-3' });
    expect(retry.next.handle).toHaveBeenCalled();
  });

  it('a mesma chave de outro usuário executa normalmente', async () => {
    const service = makeIdempotencyService();
    await firstValueFrom((await run({ service })).result$);

    const other = await run({
      service,
      req: baseRequest({ user: { userId: 'u2' } }),
      result: { id: 'mov-2' },
    });

    await expect(firstValueFrom(other.result$)).resolves.toEqual({ id: 'mov-2' });
    expect(other.next.handle).toHaveBeenCalled();
  });

  it('a mesma chave em outra rota executa normalmente', async () => {
    const service = makeIdempotencyService();
    await firstValueFrom((await run({ service })).result$);

    const other = await run({
      service,
      req: baseRequest({ originalUrl: '/api/v1/incidents' }),
      result: { id: 'inc-1' },
    });

    await expect(firstValueFrom(other.result$)).resolves.toEqual({ id: 'inc-1' });
    expect(other.next.handle).toHaveBeenCalled();
  });

  it('ignora a querystring ao escopar a chave', async () => {
    const { service, result$ } = await run({
      req: baseRequest({ originalUrl: `${PATH}?debug=1` }),
    });

    await firstValueFrom(result$);
    expect(service.reserve).toHaveBeenCalledWith(expect.objectContaining({ path: PATH }));
  });

  it('cai para req.url quando não há originalUrl', async () => {
    const { service, result$ } = await run({
      req: baseRequest({ originalUrl: undefined, url: '/api/v1/incidents' }),
    });

    await firstValueFrom(result$);
    expect(service.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/incidents' }),
    );
  });
});
