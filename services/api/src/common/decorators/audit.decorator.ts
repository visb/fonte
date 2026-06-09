import { SetMetadata } from '@nestjs/common';

// Marca um handler para registro em audit log (LGPD art. 37). O AuditInterceptor
// grava a operação após execução bem-sucedida, capturando usuário, alvo e origem.
export const AUDIT_KEY = 'auditMeta';

export interface AuditMeta {
  action: string;
  targetType?: string;
  // Nome da chave que identifica o alvo (default 'id'). Resolvida na ordem
  // route param → corpo da requisição → usuário autenticado.
  targetParam?: string;
}

export const Audit = (action: string, targetType?: string, targetParam = 'id') =>
  SetMetadata<string, AuditMeta>(AUDIT_KEY, { action, targetType, targetParam });
