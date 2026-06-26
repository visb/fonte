import { ConfigService } from '@nestjs/config';
import { Role, ProfileType } from '@fonte/types';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  function makeStrategy() {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    return new JwtStrategy(config);
  }

  it('maps the JWT payload to the request user shape', () => {
    const strategy = makeStrategy();
    const payload: JwtPayload = {
      sub: 'user-1',
      role: Role.ADMIN,
      profileType: ProfileType.STAFF,
      mustChangePassword: false,
    };
    expect(strategy.validate(payload)).toEqual({
      userId: 'user-1',
      role: Role.ADMIN,
      profileType: ProfileType.STAFF,
      mustChangePassword: false,
    });
  });

  it('carries the mustChangePassword flag through', () => {
    const strategy = makeStrategy();
    const result = strategy.validate({
      sub: 'u2',
      role: Role.RELATIVE,
      profileType: ProfileType.RELATIVE,
      mustChangePassword: true,
    });
    expect(result.mustChangePassword).toBe(true);
  });
});
