/**
 * Validação cliente de anexos (story 73): espelha a allowlist e o limite do
 * backend (autoridade). Imagens + documentos (PDF, doc/docx, xls/xlsx). Sem
 * áudio nesta story (é a 74).
 */
export const ATTACHMENT_ALLOWED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export function isAllowedAttachment(mimeType: string): boolean {
  return (ATTACHMENT_ALLOWED_MIMETYPES as readonly string[]).includes(mimeType);
}

/**
 * Valida tipo e tamanho. Retorna a mensagem de erro (pt-BR) ou null se válido.
 * `size` pode ser undefined quando o picker não informa — nesse caso só valida o
 * tipo (o backend ainda barra por tamanho).
 */
export function validateAttachment(
  mimeType: string,
  size?: number,
): string | null {
  if (!isAllowedAttachment(mimeType)) {
    return 'Tipo de arquivo não permitido. Use imagem, PDF, Word ou Excel.';
  }
  if (size != null && size > ATTACHMENT_MAX_BYTES) {
    return 'Arquivo muito grande. O limite é 20 MB.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
