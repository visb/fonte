import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../../common/observability/request-context';
import { AuditRequestContext, auditContext, stripQuery } from './audit-context';
import { AuditService } from './audit.service';

/** Rota de login (com o prefixo global). */
const LOGIN_PATH = /\/auth\/login\/?$/;

/**
 * Abre o contexto de auditoria de cada requisição (story 199).
 *
 * Por que middleware: no login não há `req.user`, e rejeições de DTO
 * (`ValidationPipe`) e de throttle acontecem antes do handler/interceptor. O
 * middleware envolve a cadeia inteira e, só no login, grava UMA ocorrência por
 * tentativa em `res.on('finish')` — quando o status final é conhecido.
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly auditService: AuditService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = stripQuery(req.originalUrl ?? req.url ?? null);
    const ctx: AuditRequestContext = {
      // Mesmo id do `X-Request-Id` da observabilidade (story 191) quando houver.
      requestId: requestContext.getStore()?.requestId ?? randomUUID(),
      userId: null,
      role: null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      httpMethod: req.method ?? null,
      path,
    };

    if (req.method === 'POST' && path && LOGIN_PATH.test(path)) {
      res.on('finish', () => {
        const identifier = (req.body as { identifier?: unknown } | undefined)?.identifier;
        void this.auditService.recordLogin(ctx, res.statusCode, identifier);
      });
    }

    auditContext.run(ctx, next);
  }
}
