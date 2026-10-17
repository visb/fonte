jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LoginFailureReason, ProfileType, Role } from '@fonte/types';
import { AuditRequestContext, auditContext } from '../audit/audit-context';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

const compare = bcrypt.compare as jest.Mock;

function makeService(userServiceOverrides: Partial<UserService> = {}, sign = jest.fn().mockReturnValue('jwt')) {
  const userService = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findActiveUserIdsByPhone: jest.fn().mockResolvedValue([]),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    ...userServiceOverrides,
  } as unknown as UserService;
  const jwtService = { sign } as unknown as JwtService;
  return { service: new AuthService(userService, jwtService), userService, sign };
}

// Story 199 — o motivo da falha vai só para o contexto de auditoria; a resposta
// ao cliente segue "Credenciais inválidas" em todos os casos.
describe('AuthService.login — anotação para a auditoria (story 199)', () => {
  beforeEach(() => compare.mockReset());

  async function attempt(
    overrides: Partial<UserService>,
    identifier: string,
  ): Promise<{ login: AuditRequestContext['login']; error: unknown }> {
    const ctx: AuditRequestContext = {
      requestId: 'r',
      userId: null,
      role: null,
      ipAddress: null,
      httpMethod: 'POST',
      path: '/api/v1/auth/login',
    };
    const { service } = makeService(overrides);
    let error: unknown = null;
    await auditContext.run(ctx, () =>
      service.login({ identifier, password: 'p' } as never).catch((e) => {
        error = e;
      }),
    );
    return { login: ctx.login, error };
  }

  const active = { id: 'u1', isActive: true, passwordHash: 'h', role: Role.SERVANT, mustChangePassword: false };

  it.each([
    ['e-mail inexistente', { findByEmail: jest.fn().mockResolvedValue(null) }, 'x@y.com', LoginFailureReason.UNKNOWN_IDENTIFIER],
    ['identificador sem dígitos', {}, 'abc', LoginFailureReason.UNKNOWN_IDENTIFIER],
    ['telefone inexistente', {}, '11000000000', LoginFailureReason.UNKNOWN_IDENTIFIER],
    ['telefone ambíguo', { findActiveUserIdsByPhone: jest.fn().mockResolvedValue(['a', 'b']) }, '11999990000', LoginFailureReason.AMBIGUOUS_IDENTIFIER],
    ['usuário inativo', { findByEmail: jest.fn().mockResolvedValue({ ...active, isActive: false }) }, 'x@y.com', LoginFailureReason.INACTIVE_USER],
  ])('%s → %s, mesma mensagem externa', async (_label, overrides, identifier, reason) => {
    const { login, error } = await attempt(overrides as Partial<UserService>, identifier);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as Error).message).toBe('Credenciais inválidas');
    expect(login).toEqual({ userId: null, role: null, reason });
  });

  it('senha errada → INVALID_CREDENTIALS, sem atribuir o usuário digitado', async () => {
    compare.mockResolvedValue(false);
    const { login } = await attempt({ findByEmail: jest.fn().mockResolvedValue(active) }, 'x@y.com');
    expect(login).toEqual({ userId: null, role: null, reason: LoginFailureReason.INVALID_CREDENTIALS });
  });

  it('sucesso anota o usuário resolvido pelo auth', async () => {
    compare.mockResolvedValue(true);
    const { login, error } = await attempt({ findByEmail: jest.fn().mockResolvedValue(active) }, 'x@y.com');
    expect(error).toBeNull();
    expect(login).toEqual({ userId: 'u1', role: Role.SERVANT, reason: null });
  });
});

describe('AuthService.login', () => {
  beforeEach(() => compare.mockReset());

  it('rejects an unknown user', async () => {
    const { service } = makeService({ findByEmail: jest.fn().mockResolvedValue(null) });
    await expect(service.login({ identifier: 'x@y.com', password: 'p' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user', async () => {
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: false, passwordHash: 'h', role: Role.SERVANT }),
    });
    await expect(service.login({ identifier: 'x@y.com', password: 'p' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password', async () => {
    compare.mockResolvedValue(false);
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.SERVANT }),
    });
    await expect(service.login({ identifier: 'x@y.com', password: 'wrong' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logs in by phone when exactly one user matches', async () => {
    compare.mockResolvedValue(true);
    const findById = jest.fn().mockResolvedValue({ id: 'u9', isActive: true, passwordHash: 'h', role: Role.RELATIVE, mustChangePassword: false });
    const findActiveUserIdsByPhone = jest.fn().mockResolvedValue(['u9']);
    const { service } = makeService({ findActiveUserIdsByPhone, findById });
    const result = await service.login({ identifier: '(11) 99999-0000', password: 'right' } as never);
    expect(findActiveUserIdsByPhone).toHaveBeenCalledWith('11999990000');
    expect(result.profileType).toBe(ProfileType.RELATIVE);
  });

  it('rejects an ambiguous phone matching more than one user', async () => {
    compare.mockResolvedValue(true);
    const { service } = makeService({
      findActiveUserIdsByPhone: jest.fn().mockResolvedValue(['u1', 'u2']),
    });
    await expect(service.login({ identifier: '11999990000', password: 'right' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown phone', async () => {
    const { service } = makeService({
      findActiveUserIdsByPhone: jest.fn().mockResolvedValue([]),
    });
    await expect(service.login({ identifier: '11000000000', password: 'p' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns a token and STAFF profile for a servant', async () => {
    compare.mockResolvedValue(true);
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.SERVANT, mustChangePassword: false }),
    });
    const result = await service.login({ identifier: 'x@y.com', password: 'right' } as never);
    expect(result).toEqual({ accessToken: 'jwt', profileType: ProfileType.STAFF });
  });

  it('maps RELATIVE role to the RELATIVE profile type', async () => {
    compare.mockResolvedValue(true);
    const { service, sign } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.RELATIVE, mustChangePassword: false }),
    });
    const result = await service.login({ identifier: 'r@y.com', password: 'right' } as never);
    expect(result.profileType).toBe(ProfileType.RELATIVE);
    expect(sign.mock.calls[0][0]).toMatchObject({ sub: 'u1', role: Role.RELATIVE, profileType: ProfileType.RELATIVE });
  });
});

describe('AuthService.changePassword', () => {
  it('throws NotFound for a missing user', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(null) });
    await expect(service.changePassword('nope', 'newpass123')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists the new hash and returns a fresh token', async () => {
    const updatePassword = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue({ id: 'u1', role: Role.SERVANT }),
      updatePassword,
    });
    const result = await service.changePassword('u1', 'newpass123');
    expect(updatePassword).toHaveBeenCalledWith('u1', 'hashed');
    expect(result.accessToken).toBe('jwt');
  });
});
