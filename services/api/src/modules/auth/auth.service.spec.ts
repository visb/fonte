jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProfileType, Role } from '@fonte/types';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

const compare = bcrypt.compare as jest.Mock;

function makeService(userServiceOverrides: Partial<UserService> = {}, sign = jest.fn().mockReturnValue('jwt')) {
  const userService = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    ...userServiceOverrides,
  } as unknown as UserService;
  const jwtService = { sign } as unknown as JwtService;
  return { service: new AuthService(userService, jwtService), userService, sign };
}

describe('AuthService.login', () => {
  beforeEach(() => compare.mockReset());

  it('rejects an unknown user', async () => {
    const { service } = makeService({ findByEmail: jest.fn().mockResolvedValue(null) });
    await expect(service.login({ email: 'x@y.com', password: 'p' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user', async () => {
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: false, passwordHash: 'h', role: Role.SERVANT }),
    });
    await expect(service.login({ email: 'x@y.com', password: 'p' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password', async () => {
    compare.mockResolvedValue(false);
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.SERVANT }),
    });
    await expect(service.login({ email: 'x@y.com', password: 'wrong' } as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns a token and STAFF profile for a servant', async () => {
    compare.mockResolvedValue(true);
    const { service } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.SERVANT, mustChangePassword: false }),
    });
    const result = await service.login({ email: 'x@y.com', password: 'right' } as never);
    expect(result).toEqual({ accessToken: 'jwt', profileType: ProfileType.STAFF });
  });

  it('maps RELATIVE role to the RELATIVE profile type', async () => {
    compare.mockResolvedValue(true);
    const { service, sign } = makeService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, passwordHash: 'h', role: Role.RELATIVE, mustChangePassword: false }),
    });
    const result = await service.login({ email: 'r@y.com', password: 'right' } as never);
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
