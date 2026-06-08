import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';

// Grava audit log para handlers decorados com @Audit, após execução bem-sucedida.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const targetParam = meta.targetParam ?? 'id';

    return next.handle().pipe(
      tap(() => {
        void this.auditService.record({
          userId: req.user?.userId ?? null,
          role: req.user?.role ?? null,
          action: meta.action,
          targetType: meta.targetType ?? null,
          targetId: req.params?.[targetParam] ?? null,
          httpMethod: req.method ?? null,
          path: req.originalUrl ?? req.url ?? null,
          ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
        });
      }),
    );
  }
}
