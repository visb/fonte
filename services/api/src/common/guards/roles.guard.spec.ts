import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@fonte/types';
import { RolesGuard } from './roles.guard';

function makeContext(role?: Role) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as never;
}

function makeGuard(required: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    expect(makeGuard(undefined).canActivate(makeContext(Role.SERVANT))).toBe(true);
  });

  it('allows when the required list is empty', () => {
    expect(makeGuard([]).canActivate(makeContext(Role.SERVANT))).toBe(true);
  });

  it('allows when the user role is in the required set', () => {
    expect(makeGuard([Role.ADMIN]).canActivate(makeContext(Role.ADMIN))).toBe(true);
  });

  it('throws Forbidden when the user role is not allowed', () => {
    expect(() => makeGuard([Role.ADMIN]).canActivate(makeContext(Role.SERVANT))).toThrow(
      ForbiddenException,
    );
  });

  it('throws Forbidden when there is no authenticated user', () => {
    expect(() => makeGuard([Role.ADMIN]).canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
