import { LoginFailureReason } from '@fonte/types';
import { auditContext, currentAuditContext, noteLoginAttempt, stripQuery } from './audit-context';
import { AuditContextMiddleware } from './audit-context.middleware';
import { requestContext, createRequestStore } from '../../common/observability/request-context';

describe('audit-context', () => {
  it('stripQuery remove a query string', () => {
    expect(stripQuery('/a/b?token=1')).toBe('/a/b');
    expect(stripQuery('/a/b')).toBe('/a/b');
    expect(stripQuery(null)).toBeNull();
  });

  it('noteLoginAttempt anota no contexto ativo e é no-op fora dele', () => {
    noteLoginAttempt({ userId: null, role: null, reason: LoginFailureReason.INACTIVE_USER });
    const ctx = { requestId: 'r', userId: null, role: null, ipAddress: null, httpMethod: null, path: null };
    auditContext.run(ctx, () => {
      noteLoginAttempt({ userId: 'u1', role: 'ADMIN', reason: null });
      expect(currentAuditContext()?.login).toEqual({ userId: 'u1', role: 'ADMIN', reason: null });
    });
  });
});

describe('AuditContextMiddleware', () => {
  function makeRes() {
    const listeners: Record<string, () => void> = {};
    return {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      finish: () => listeners.finish?.(),
    };
  }

  it('abre o contexto com o requestId da observabilidade, IP e path sem query', () => {
    const recordLogin = jest.fn();
    const mw = new AuditContextMiddleware({ recordLogin } as never);
    const res = makeRes();
    let seen: unknown;
    requestContext.run(createRequestStore('obs-1'), () =>
      mw.use(
        { method: 'GET', originalUrl: '/api/v1/residents?search=ana', ip: '1.1.1.1' } as never,
        res as never,
        () => {
          seen = currentAuditContext();
        },
      ),
    );
    expect(seen).toMatchObject({
      requestId: 'obs-1',
      ipAddress: '1.1.1.1',
      httpMethod: 'GET',
      path: '/api/v1/residents',
      userId: null,
    });
    expect(res.on).not.toHaveBeenCalled();
  });

  it('no login grava UMA ocorrência no finish, com o status final e o identificador do corpo', () => {
    const recordLogin = jest.fn().mockResolvedValue(undefined);
    const mw = new AuditContextMiddleware({ recordLogin } as never);
    const res = makeRes();
    mw.use(
      {
        method: 'POST',
        url: '/api/v1/auth/login',
        socket: { remoteAddress: '2.2.2.2' },
        body: { identifier: 'ana@fonte.com', password: 'segredo' },
      } as never,
      res as never,
      () => undefined,
    );
    res.statusCode = 401;
    res.finish();
    expect(recordLogin).toHaveBeenCalledTimes(1);
    const [ctx, status, identifier] = recordLogin.mock.calls[0];
    expect(ctx).toMatchObject({ ipAddress: '2.2.2.2', path: '/api/v1/auth/login' });
    expect(typeof ctx.requestId).toBe('string');
    expect(status).toBe(401);
    expect(identifier).toBe('ana@fonte.com');
  });

  it('não confunde troca de senha com login', () => {
    const recordLogin = jest.fn();
    const mw = new AuditContextMiddleware({ recordLogin } as never);
    const res = makeRes();
    mw.use({ method: 'POST', originalUrl: '/api/v1/auth/change-password' } as never, res as never, () => undefined);
    expect(res.on).not.toHaveBeenCalled();
  });
});
