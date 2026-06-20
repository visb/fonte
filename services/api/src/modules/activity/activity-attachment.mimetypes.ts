import { ActivityAttachmentType } from '@fonte/types';

/**
 * Allowlist de mimetypes aceitos como anexo de atividade/comentário (story 73):
 * imagens + documentos (PDF, doc/docx, xls/xlsx). SEM áudio — áudio é a story 74,
 * que estende esta lista. O controller valida contra ela (defesa contra upload
 * arbitrário); o backend é a autoridade.
 */
export const ACTIVITY_ATTACHMENT_MIMETYPES = new Set<string>([
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

/** Limite de tamanho por anexo (igual ao módulo message). */
export const ACTIVITY_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export function isAllowedAttachmentMimetype(mimetype: string): boolean {
  return ACTIVITY_ATTACHMENT_MIMETYPES.has(mimetype);
}

/** Deriva o tipo de anexo do mimetype (apenas image|document nesta story). */
export function attachmentTypeFromMimetype(
  mimetype: string,
): ActivityAttachmentType {
  return mimetype.startsWith('image/') ? 'image' : 'document';
}
