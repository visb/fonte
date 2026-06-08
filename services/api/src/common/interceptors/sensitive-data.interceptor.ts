import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Role } from '@fonte/types';
import { REVEAL_SENSITIVE_KEY } from '../decorators/reveal-sensitive.decorator';
import { maskSensitiveFields } from '../lib/mask';

// LGPD — mascara CPF/RG em toda resposta JSON, exceto quando o handler é
// marcado com @RevealSensitive() E o solicitante é ADMIN ou COORDINATOR.
// SERVANT e qualquer listagem recebem sempre o dado mascarado.
@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const canReveal = this.reflector.getAllAndOverride<boolean>(REVEAL_SENSITIVE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { user } = context.switchToHttp().getRequest();
    const privileged = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;

    if (canReveal && privileged) return next.handle();

    return next.handle().pipe(
      map((data) => {
        maskSensitiveFields(data);
        return data;
      }),
    );
  }
}
