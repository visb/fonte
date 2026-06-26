import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../../modules/audit/audit.service';

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
  const record = jest.fn().mockResolvedValue(undefined);
  const auditService = { record } as unknown as AuditService;
  const interceptor = new AuditInterceptor(reflector, auditService);
  const next = { handle: jest.fn().mockReturnValue(of('result')) };
  const result$ = interceptor.intercept(makeContext(req), next as never);
  return { record, next, result$ };
}

describe('AuditInterceptor', () => {
  it('passes through without recording when handler is not decorated', (done) => {
    const { record, next, result$ } = run(undefined, {});
    result$.subscribe((v) => {
      expect(v).toBe('result');
      expect(next.handle).toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      done();
    });
  });

  it('records an audit entry from route params after success', (done) => {
    const meta = { action: 'resident.read', targetType: 'resident' };
    const req = {
      params: { id: 'r1' },
      user: { userId: 'u1', role: 'ADMIN' },
      method: 'GET',
      originalUrl: '/residents/r1',
      ip: '1.2.3.4',
    };
    const { record, result$ } = run(meta, req);
    result$.subscribe(() => {
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'resident.read',
          targetType: 'resident',
          targetId: 'r1',
          userId: 'u1',
          role: 'ADMIN',
          httpMethod: 'GET',
          path: '/residents/r1',
          ipAddress: '1.2.3.4',
        }),
      );
      done();
    });
  });

  it('falls back to body, custom targetParam and socket address', (done) => {
    const meta = { action: 'consent.update', targetParam: 'subjectId' };
    const req = {
      body: { subjectId: 's9' },
      socket: { remoteAddress: '9.9.9.9' },
      url: '/consent',
    };
    const { record, result$ } = run(meta, req);
    result$.subscribe(() => {
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: 's9',
          targetType: null,
          userId: null,
          role: null,
          path: '/consent',
          ipAddress: '9.9.9.9',
        }),
      );
      done();
    });
  });
});
