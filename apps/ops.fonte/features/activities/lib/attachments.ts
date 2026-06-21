/**
 * Validação cliente de anexos (story 73 + áudio na 74): espelha a allowlist e o
 * limite do backend (autoridade). Imagens + documentos (PDF, doc/docx, xls/xlsx)
 * + áudio gravado/enviado pelo device (`expo-av` → `audio/m4a`/`aac`/`mp4`).
 */
export const ATTACHMENT_AUDIO_MIMETYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
] as const;

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
  ...ATTACHMENT_AUDIO_MIMETYPES,
] as const;

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

/** Duração máxima de áudio aceita pelo cliente (story 74): 2 minutos. */
export const AUDIO_MAX_DURATION_SECONDS = 120;

export function isAllowedAttachment(mimeType: string): boolean {
  return (ATTACHMENT_ALLOWED_MIMETYPES as readonly string[]).includes(mimeType);
}

export function isAudioMimetype(mimeType: string): boolean {
  return (
    mimeType.startsWith('audio/') ||
    (ATTACHMENT_AUDIO_MIMETYPES as readonly string[]).includes(mimeType)
  );
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
    return 'Tipo de arquivo não permitido. Use imagem, áudio, PDF, Word ou Excel.';
  }
  if (size != null && size > ATTACHMENT_MAX_BYTES) {
    return 'Arquivo muito grande. O limite é 20 MB.';
  }
  return null;
}

/**
 * Valida a duração de um áudio (story 74). Retorna a mensagem de erro (pt-BR) ou
 * null se válido. A duração é medida no cliente; o backend só garante o tamanho.
 */
export function validateAudioDuration(
  durationSeconds: number | undefined,
): string | null {
  if (
    durationSeconds != null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > AUDIO_MAX_DURATION_SECONDS
  ) {
    return 'Áudio muito longo. O limite é 2 minutos.';
  }
  return null;
}

/** Formata segundos como mm:ss para o player de áudio. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
