/**
 * Allowlist de mimetypes aceitos como anexo de servo (story 98): documentos e
 * imagens (anexo genérico, como o do resident — sem áudio). O service valida
 * contra ela (defesa contra upload arbitrário); o backend é a autoridade.
 */
export const STAFF_ATTACHMENT_MIMETYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Limite de tamanho por anexo (igual aos módulos activity/message). */
export const STAFF_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export function isAllowedStaffAttachmentMimetype(mimetype: string): boolean {
  return STAFF_ATTACHMENT_MIMETYPES.has(mimetype);
}
