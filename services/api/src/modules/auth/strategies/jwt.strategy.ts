import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role, ProfileType } from '@fonte/types';

export interface JwtPayload {
  sub: string;
  role: Role;
  profileType: ProfileType;
  mustChangePassword: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      role: payload.role,
      profileType: payload.profileType,
      mustChangePassword: payload.mustChangePassword,
    };
  }
}
