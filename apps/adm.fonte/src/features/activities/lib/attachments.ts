/**
 * Validação cliente de anexos (story 73): espelha a allowlist e o limite do
 * backend (que é a autoridade). Imagens + documentos (PDF, doc/docx, xls/xlsx).
 * Sem áudio nesta story (áudio é a 74).
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

/** Extensões aceitas, para o atributo `accept` do input file. */
export const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx';

export function isAllowedAttachment(file: File): boolean {
  return (ATTACHMENT_ALLOWED_MIMETYPES as readonly string[]).includes(
    file.type,
  );
}

/**
 * Valida tipo e tamanho no cliente antes de enviar. Retorna a mensagem de erro
 * (pt-BR) ou null se válido. O backend revalida; isto é só UX.
 */
export function validateAttachment(file: File): string | null {
  if (!isAllowedAttachment(file)) {
    return 'Tipo de arquivo não permitido. Use imagem, PDF, Word ou Excel.';
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return 'Arquivo muito grande. O limite é 20 MB.';
  }
  return null;
}

/** Formata o tamanho em bytes para exibição (KB/MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
