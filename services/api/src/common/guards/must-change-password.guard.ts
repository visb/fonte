import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import {
  SKIP_PASSWORD_CHECK_KEY,
} from '../decorators/skip-password-check.decorator';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true;

    try {
      const token = authHeader.slice(7);
      const secret = this.configService.get<string>('JWT_SECRET')!;
      const payload = jwt.verify(token, secret) as { mustChangePassword?: boolean };

      if (payload.mustChangePassword) {
        throw new ForbiddenException({
          error: 'MUST_CHANGE_PASSWORD',
          message: 'É necessário definir uma nova senha antes de continuar.',
        });
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      // token inválido/expirado — deixa o JwtAuthGuard rejeitar
    }

    return true;
  }
}
