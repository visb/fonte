import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { currentAuditContext, stripQuery } from '../../modules/audit/audit-context';

/**
 * Dois papéis (story 199):
 * 1. Em TODA requisição, depois dos guards, preenche o autor no contexto de
 *    auditoria — é o que os services usam ao gravar eventos transacionais.
 * 2. Em handlers com `@Audit`, grava o evento após o sucesso, AGUARDANDO a
 *    gravação (falha vira aviso sanitizado no AuditService, sem derrubar a
 *    resposta). Path sempre sem query string.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const ctx = currentAuditContext();
    if (ctx && req?.user) {
      ctx.userId = req.user.userId ?? null;
      ctx.role = req.user.role ?? null;
    }

    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const targetKey = meta.targetParam ?? 'id';
    // O alvo pode chegar como route param, no corpo (ex.: subjectId) ou no
    // próprio usuário autenticado (ex.: userId em autoatendimento).
    const targetId =
      req.params?.[targetKey] ?? req.body?.[targetKey] ?? req.user?.[targetKey] ?? null;
    const parentId = meta.parentParam ? (req.params?.[meta.parentParam] ?? null) : null;

    return next.handle().pipe(
      concatMap(async (value) => {
        await this.auditService.recordEvent({
          userId: req.user?.userId ?? null,
          role: req.user?.role ?? null,
          action: meta.action,
          targetType: meta.targetType ?? null,
          targetId,
          parentType: meta.parentType ?? null,
          parentId,
          context: meta.context ? meta.context(req) : null,
          httpMethod: req.method ?? null,
          path: stripQuery(req.originalUrl ?? req.url ?? null),
          ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
        });
        return value;
      }),
    );
  }
}
