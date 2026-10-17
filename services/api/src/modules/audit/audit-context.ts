import { AsyncLocalStorage } from 'node:async_hooks';
import { LoginFailureReason } from '@fonte/types';

/**
 * Contexto de auditoria da requisição (story 199).
 *
 * Aberto pelo `AuditContextMiddleware` em TODA requisição; o `AuditInterceptor`
 * preenche o autor depois dos guards (é quando o `req.user` existe). Assim
 * qualquer service, em qualquer profundidade, grava o evento com autor, IP,
 * rota e correlação sem receber isso por parâmetro.
 *
 * Objeto MUTÁVEL de propósito (mesmo desenho do `request-context` da story 191).
 * Fora de requisição (cron, seed) não há store — o autor fica nulo.
 */
export interface LoginAttemptNote {
  userId: string | null;
  role: string | null;
  reason: LoginFailureReason | null;
}

export interface AuditRequestContext {
  /** Também é a correlação: eventos de uma mesma requisição (lote) a compartilham. */
  requestId: string;
  userId: string | null;
  role: string | null;
  ipAddress: string | null;
  httpMethod: string | null;
  /** Sem query string. */
  path: string | null;
  /** Preenchido pelo AuthService durante o login (nunca a senha). */
  login?: LoginAttemptNote;
}

export const auditContext = new AsyncLocalStorage<AuditRequestContext>();

export function currentAuditContext(): AuditRequestContext | undefined {
  return auditContext.getStore();
}

/** Remove query string — nunca persistimos parâmetros de consulta. */
export function stripQuery(path: string | null | undefined): string | null {
  if (!path) return null;
  const index = path.indexOf('?');
  return index === -1 ? path : path.slice(0, index);
}

/** Anota o desfecho do login no contexto (chamado pelo AuthService). */
export function noteLoginAttempt(note: LoginAttemptNote): void {
  const ctx = currentAuditContext();
  if (ctx) ctx.login = note;
}
