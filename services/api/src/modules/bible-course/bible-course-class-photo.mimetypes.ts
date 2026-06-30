/**
 * Allowlist de mimetypes aceitos como foto de turma do curso bíblico (story 92).
 * Restrito a imagens (jpeg/png/webp/heic) — a galeria é só registro visual. O
 * controller/service valida contra ela (defesa contra upload arbitrário); o
 * backend é a autoridade.
 */
export const BIBLE_COURSE_CLASS_PHOTO_MIMETYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** Limite de tamanho por foto (igual ao módulo de anexos de atividade). */
export const BIBLE_COURSE_CLASS_PHOTO_MAX_BYTES = 20 * 1024 * 1024;

export function isAllowedClassPhotoMimetype(mimetype: string): boolean {
  return BIBLE_COURSE_CLASS_PHOTO_MIMETYPES.has(mimetype);
}
