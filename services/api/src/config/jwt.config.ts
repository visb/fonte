import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const getJwtConfig = (config: ConfigService): JwtModuleOptions => ({
  secret: config.get<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
  },
});
