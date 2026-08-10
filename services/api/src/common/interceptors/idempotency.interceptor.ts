import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import { IdempotencyStatus } from '../../modules/idempotency/idempotency-key.entity';
import {
  IdempotencyScope,
  IdempotencyService,
} from '../../modules/idempotency/idempotency.service';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

// Formato UUID (qualquer versão). Cliente com bug mandando lixo geraria linhas
// ilimitadas na tabela — daí o 400 em vez de aceitar qualquer string (decisão 9).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Story 172 — dedupe de escrita para o replay da outbox do ops (epic 167/169).
 *
 * Global como o `AuditInterceptor`, mas inerte sem `@Idempotent()` no handler.
 * Fluxo: reserva a chave ANTES de executar (o unique do banco é o que resolve
 * duas cópias simultâneas), memoriza só a resposta de sucesso e libera a reserva
 * quando o handler falha — erro cacheado impediria o operador de corrigir e
 * reenviar.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = context.switchToHttp().getRequest();
    const raw = req.headers?.[IDEMPOTENCY_HEADER];
    const key = Array.isArray(raw) ? raw[0] : raw;
    // Sem header a requisição segue o comportamento de hoje (decisão 8).
    if (!key) return next.handle();
    if (typeof key !== 'string' || !UUID_PATTERN.test(key)) {
      throw new BadRequestException('Header Idempotency-Key deve ser um UUID.');
    }

    // A chave é escopada pelo dono (decisão 6); rota sem usuário autenticado não
    // tem escopo — e nenhum handler do escopo desta story é anônimo.
    const userId: string | undefined = req.user?.userId;
    if (!userId) return next.handle();

    const scope: IdempotencyScope = {
      key,
      userId,
      httpMethod: String(req.method ?? ''),
      path: normalizePath(req),
    };

    const reservation = await this.idempotency.reserve(scope);
    if (!reservation) return this.replay(context, scope);

    const statusCode = resolveStatusCode(context, req);
    return next.handle().pipe(
      catchError((error) =>
        from(this.idempotency.release(reservation.id)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
      mergeMap((body) =>
        from(this.idempotency.complete(reservation.id, statusCode, body)).pipe(map(() => body)),
      ),
    );
  }

  /** Duplicata: devolve a resposta memorizada sem executar o handler, ou 409 se a original ainda roda. */
  private async replay(
    context: ExecutionContext,
    scope: IdempotencyScope,
  ): Promise<Observable<unknown>> {
    const existing = await this.idempotency.findByScope(scope);
    if (existing?.status !== IdempotencyStatus.COMPLETED) {
      throw new ConflictException(
        'Requisição com esta Idempotency-Key ainda está em processamento.',
      );
    }
    // O Nest reaplica o status do handler ao enviar; setar aqui preserva o status
    // memorizado para handlers que definem o código dinamicamente.
    const res = context.switchToHttp().getResponse<{ status(code: number): unknown }>();
    res.status(existing.responseStatus ?? HttpStatus.OK);
    return of(existing.responseBody);
  }
}

/** Caminho sem querystring — o mesmo lançamento reenviado bate sempre no mesmo path. */
function normalizePath(req: { originalUrl?: string; url?: string }): string {
  const raw = req.originalUrl ?? req.url ?? '';
  return raw.split('?')[0].slice(0, 512);
}

/**
 * O Nest só aplica o status depois da cadeia de interceptors (`res.statusCode`
 * ainda é o default do Express aqui), então o status memorizado vem da mesma
 * fonte que o Nest usa: `@HttpCode` ou o default do verbo.
 */
function resolveStatusCode(context: ExecutionContext, req: { method?: string }): number {
  const explicit = Reflect.getMetadata(HTTP_CODE_METADATA, context.getHandler());
  if (typeof explicit === 'number') return explicit;
  return req.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK;
}
