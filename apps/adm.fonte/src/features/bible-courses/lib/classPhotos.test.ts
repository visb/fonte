import { describe, expect, it } from 'vitest';
import {
  CLASS_PHOTO_ACCEPT,
  CLASS_PHOTO_MIMETYPES,
  isAllowedClassPhoto,
} from './classPhotos';

describe('classPhotos', () => {
  it.each([...CLASS_PHOTO_MIMETYPES])('aceita %s', (m) =>
    expect(isAllowedClassPhoto(m)).toBe(true),
  );

  it.each(['application/pdf', 'audio/mpeg', 'image/gif', ''])('rejeita %s', (m) =>
    expect(isAllowedClassPhoto(m)).toBe(false),
  );

  it('o accept inclui todos os mimetypes', () => {
    expect(CLASS_PHOTO_ACCEPT).toBe('image/jpeg,image/png,image/webp,image/heic,image/heif');
  });
});
