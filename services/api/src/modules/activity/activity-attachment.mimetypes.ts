import { ActivityAttachmentType } from '@fonte/types';

/**
 * Allowlist de mimetypes aceitos como anexo de atividade/comentário: imagens +
 * documentos (PDF, doc/docx, xls/xlsx) da story 73, estendida na story 74 com os
 * tipos de áudio que os devices gravam (web `MediaRecorder` → `audio/webm`; iOS/
 * Android `expo-av` → `audio/mp4`/`m4a`/`aac`) e os formatos comuns de upload.
 * Salva o formato nativo, sem transcodar. O controller valida contra ela (defesa
 * contra upload arbitrário); o backend é a autoridade.
 */
export const ACTIVITY_ATTACHMENT_AUDIO_MIMETYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
] as const;

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
  ...ACTIVITY_ATTACHMENT_AUDIO_MIMETYPES,
]);

/** Limite de tamanho por anexo (igual ao módulo message). */
export const ACTIVITY_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export function isAllowedAttachmentMimetype(mimetype: string): boolean {
  return ACTIVITY_ATTACHMENT_MIMETYPES.has(mimetype);
}

/** Deriva o tipo de anexo do mimetype: image | audio | document. */
export function attachmentTypeFromMimetype(
  mimetype: string,
): ActivityAttachmentType {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}
