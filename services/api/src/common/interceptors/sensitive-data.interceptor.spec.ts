import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { Role } from '@fonte/types';
import { SensitiveDataInterceptor } from './sensitive-data.interceptor';

function makeContext(role?: Role) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as never;
}

function run(canReveal: boolean, role: Role | undefined, data: unknown) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(canReveal),
  } as unknown as Reflector;
  const interceptor = new SensitiveDataInterceptor(reflector);
  const next = { handle: jest.fn().mockReturnValue(of(data)) };
  return interceptor.intercept(makeContext(role), next as never);
}

describe('SensitiveDataInterceptor', () => {
  it('reveals unmasked data for ADMIN on a @RevealSensitive handler', (done) => {
    const data = { cpf: '12345678900' };
    run(true, Role.ADMIN, data).subscribe((out) => {
      expect(out).toEqual({ cpf: '12345678900' });
      done();
    });
  });

  it('reveals unmasked data for COORDINATOR on a @RevealSensitive handler', (done) => {
    const data = { cpf: '12345678900' };
    run(true, Role.COORDINATOR, data).subscribe((out) => {
      expect(out).toEqual({ cpf: '12345678900' });
      done();
    });
  });

  it('masks for SERVANT even when handler can reveal', (done) => {
    const data = { cpf: '12345678900', rg: '123456789' };
    run(true, Role.SERVANT, data).subscribe((out: any) => {
      expect(out.cpf).toBe('***.***.789-00');
      expect(out.rg).toBe('***89');
      done();
    });
  });

  it('masks when the handler is not marked to reveal', (done) => {
    const data = { cpf: '12345678900' };
    run(false, Role.ADMIN, data).subscribe((out: any) => {
      expect(out.cpf).toBe('***.***.789-00');
      done();
    });
  });

  it('masks when there is no authenticated user', (done) => {
    const data = { nested: { cpf: '12345678900' } };
    run(false, undefined, data).subscribe((out: any) => {
      expect(out.nested.cpf).toBe('***.***.789-00');
      done();
    });
  });
});
