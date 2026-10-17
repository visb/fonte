import { SetMetadata } from '@nestjs/common';

// Marca um handler para registro em audit log (LGPD art. 37). O AuditInterceptor
// grava a operação após execução bem-sucedida, capturando usuário, alvo e origem.
// Escritas do catálogo da story 199 NÃO usam este decorator: são gravadas pelo
// service, na transação da alteração (AuditService.track) — evita duplicidade.
export const AUDIT_KEY = 'auditMeta';

export interface AuditRequestLike {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

export interface AuditMetaOptions {
  /** Recurso principal relacionado (ex.: o filho dono da parcela). */
  parentType?: string;
  /** Route param com o id do recurso principal. */
  parentParam?: string;
  /** Metadados PERMITIDOS do evento (ids, formato, quantidade) — nunca conteúdo. */
  context?: (req: AuditRequestLike) => Record<string, unknown>;
}

export interface AuditMeta extends AuditMetaOptions {
  action: string;
  targetType?: string;
  // Nome da chave que identifica o alvo (default 'id'). Resolvida na ordem
  // route param → corpo da requisição → usuário autenticado.
  targetParam?: string;
}

export const Audit = (
  action: string,
  targetType?: string,
  targetParam = 'id',
  options: AuditMetaOptions = {},
) => SetMetadata<string, AuditMeta>(AUDIT_KEY, { action, targetType, targetParam, ...options });
