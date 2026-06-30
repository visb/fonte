import {
  BIBLE_COURSE_CLASS_PHOTO_MAX_BYTES,
  isAllowedClassPhotoMimetype,
} from './bible-course-class-photo.mimetypes';

describe('bible-course-class-photo.mimetypes', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])(
    'aceita imagem %s',
    (m) => expect(isAllowedClassPhotoMimetype(m)).toBe(true),
  );

  it.each(['application/pdf', 'audio/mpeg', 'image/gif', 'text/plain', ''])(
    'rejeita %s',
    (m) => expect(isAllowedClassPhotoMimetype(m)).toBe(false),
  );

  it('limite de tamanho é 20 MB', () => {
    expect(BIBLE_COURSE_CLASS_PHOTO_MAX_BYTES).toBe(20 * 1024 * 1024);
  });
});
