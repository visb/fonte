import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../../modules/audit/audit.service';
import { auditContext, AuditRequestContext } from '../../modules/audit/audit-context';

function makeContext(req: Record<string, unknown>) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function run(meta: unknown, req: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(meta),
  } as unknown as Reflector;
  const recordEvent = jest.fn().mockResolvedValue(undefined);
  const auditService = { recordEvent } as unknown as AuditService;
  const interceptor = new AuditInterceptor(reflector, auditService);
  const next = { handle: jest.fn().mockReturnValue(of('result')) };
  const result$ = interceptor.intercept(makeContext(req), next as never);
  return { recordEvent, next, result$ };
}

describe('AuditInterceptor', () => {
  it('passes through without recording when handler is not decorated', async () => {
    const { recordEvent, next, result$ } = run(undefined, {});
    await expect(lastValueFrom(result$)).resolves.toBe('result');
    expect(next.handle).toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('preenche o autor no contexto de auditoria depois dos guards (story 199)', () => {
    const ctx: AuditRequestContext = {
      requestId: 'r',
      userId: null,
      role: null,
      ipAddress: null,
      httpMethod: null,
      path: null,
    };
    auditContext.run(ctx, () => run(undefined, { user: { userId: 'u1', role: 'SERVANT' } }));
    expect(ctx).toMatchObject({ userId: 'u1', role: 'SERVANT' });
  });

  it('records (awaited) an audit entry from route params, path without query string', async () => {
    const meta = { action: 'resident.read', targetType: 'resident' };
    const req = {
      params: { id: 'r1' },
      user: { userId: 'u1', role: 'ADMIN' },
      method: 'GET',
      originalUrl: '/residents/r1?x=1',
      ip: '1.2.3.4',
    };
    const { recordEvent, result$ } = run(meta, req);
    await expect(lastValueFrom(result$)).resolves.toBe('result');
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resident.read',
        targetType: 'resident',
        targetId: 'r1',
        userId: 'u1',
        role: 'ADMIN',
        httpMethod: 'GET',
        path: '/residents/r1',
        ipAddress: '1.2.3.4',
        parentId: null,
        context: null,
      }),
    );
  });

  it('falls back to body, custom targetParam and socket address', async () => {
    const meta = { action: 'consent.update', targetParam: 'subjectId' };
    const req = {
      body: { subjectId: 's9' },
      socket: { remoteAddress: '9.9.9.9' },
      url: '/consent',
    };
    const { recordEvent, result$ } = run(meta, req);
    await lastValueFrom(result$);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 's9',
        targetType: null,
        userId: null,
        role: null,
        path: '/consent',
        ipAddress: '9.9.9.9',
      }),
    );
  });

  it('documentos: recurso principal pelo param e contexto de metadados permitidos', async () => {
    const meta = {
      action: 'resident.receivable.receipt',
      targetType: 'resident-receivable',
      targetParam: 'receivableId',
      parentType: 'resident',
      parentParam: 'id',
      context: () => ({ format: 'pdf', count: 1 }),
    };
    const { recordEvent, result$ } = run(meta, { params: { id: 'r1', receivableId: 'rc1' } });
    await lastValueFrom(result$);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 'rc1',
        parentType: 'resident',
        parentId: 'r1',
        context: { format: 'pdf', count: 1 },
      }),
    );
  });
});
