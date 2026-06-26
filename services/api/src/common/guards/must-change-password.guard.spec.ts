import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { MustChangePasswordGuard } from './must-change-password.guard';

function makeContext(authorization?: string) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as never;
}

function makeGuard(skip: boolean, secret = 'test-secret') {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(skip),
  } as unknown as Reflector;
  const config = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
  return new MustChangePasswordGuard(reflector, config);
}

describe('MustChangePasswordGuard', () => {
  const secret = 'test-secret';

  it('allows when handler is marked to skip the password check', () => {
    const guard = makeGuard(true);
    expect(guard.canActivate(makeContext('Bearer whatever'))).toBe(true);
  });

  it('allows when there is no Bearer token (lets JwtAuthGuard handle it)', () => {
    const guard = makeGuard(false);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows when the token is valid and password change is not required', () => {
    const guard = makeGuard(false);
    const token = jwt.sign({ mustChangePassword: false }, secret);
    expect(guard.canActivate(makeContext(`Bearer ${token}`))).toBe(true);
  });

  it('throws MUST_CHANGE_PASSWORD when the token flags a pending change', () => {
    const guard = makeGuard(false);
    const token = jwt.sign({ mustChangePassword: true }, secret);
    expect(() => guard.canActivate(makeContext(`Bearer ${token}`))).toThrow(
      ForbiddenException,
    );
    try {
      guard.canActivate(makeContext(`Bearer ${token}`));
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        error: 'MUST_CHANGE_PASSWORD',
      });
    }
  });

  it('allows when the token is invalid (defers rejection to JwtAuthGuard)', () => {
    const guard = makeGuard(false);
    expect(guard.canActivate(makeContext('Bearer not-a-real-jwt'))).toBe(true);
  });
});
