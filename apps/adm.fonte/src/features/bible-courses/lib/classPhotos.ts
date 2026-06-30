/**
 * Validação cliente da galeria de fotos da turma (story 92): espelha a allowlist
 * do backend (autoridade). Só imagens (jpeg/png/webp/heic).
 */
export const CLASS_PHOTO_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const CLASS_PHOTO_ACCEPT = CLASS_PHOTO_MIMETYPES.join(',');

export function isAllowedClassPhoto(mimeType: string): boolean {
  return (CLASS_PHOTO_MIMETYPES as readonly string[]).includes(mimeType);
}
