/**
 * Validação cliente de anexos (story 73 + áudio na 74): espelha a allowlist e o
 * limite do backend (que é a autoridade). Imagens + documentos (PDF, doc/docx,
 * xls/xlsx) + áudio (gravação web em `audio/webm` e uploads comuns).
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

/** Extensões aceitas, para o atributo `accept` do input file. */
export const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.webm,.mp4,.m4a,.aac,.mp3,.ogg,.wav';

/** Atributo `accept` só de áudio, para o seletor do gravador/uploader de áudio. */
export const AUDIO_ACCEPT = 'audio/*,.webm,.mp4,.m4a,.aac,.mp3,.ogg,.wav';

export function isAllowedAttachment(file: File): boolean {
  return (ATTACHMENT_ALLOWED_MIMETYPES as readonly string[]).includes(
    file.type,
  );
}

export function isAudioMimetype(mimeType: string): boolean {
  return (
    mimeType.startsWith('audio/') ||
    (ATTACHMENT_AUDIO_MIMETYPES as readonly string[]).includes(mimeType)
  );
}

/**
 * Valida tipo e tamanho no cliente antes de enviar. Retorna a mensagem de erro
 * (pt-BR) ou null se válido. O backend revalida; isto é só UX.
 */
export function validateAttachment(file: File): string | null {
  if (!isAllowedAttachment(file)) {
    return 'Tipo de arquivo não permitido. Use imagem, áudio, PDF, Word ou Excel.';
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return 'Arquivo muito grande. O limite é 20 MB.';
  }
  return null;
}

/**
 * Valida a duração de um áudio (story 74). Retorna a mensagem de erro (pt-BR) ou
 * null se válido. A duração é medida no cliente; o backend só garante o tamanho.
 */
export function validateAudioDuration(durationSeconds: number): string | null {
  if (
    Number.isFinite(durationSeconds) &&
    durationSeconds > AUDIO_MAX_DURATION_SECONDS
  ) {
    return 'Áudio muito longo. O limite é 2 minutos.';
  }
  return null;
}

/**
 * Lê a duração (segundos) de um arquivo de áudio pelos metadados, sem decodificar
 * (story 74). Resolve null se o navegador não conseguir ler. Usado para validar
 * a duração ≤ 2 min antes do upload.
 */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      cleanup();
      resolve(Number.isFinite(d) && d > 0 ? d : null);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = url;
  });
}

/** Formata segundos como mm:ss para o player de áudio. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Formata o tamanho em bytes para exibição (KB/MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
