import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  formatFileSize,
  isAllowedAttachment,
  validateAttachment,
} from './attachments';

function file(type: string, size: number): File {
  const f = new File(['x'], 'a', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('isAllowedAttachment', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])('aceita %s', (type) => {
    expect(isAllowedAttachment(file(type, 10))).toBe(true);
  });

  it.each(['application/x-msdownload', 'audio/mpeg', 'video/mp4', 'text/html'])(
    'rejeita %s (fora da allowlist; sem áudio nesta story)',
    (type) => {
      expect(isAllowedAttachment(file(type, 10))).toBe(false);
    },
  );
});

describe('validateAttachment', () => {
  it('null para arquivo válido', () => {
    expect(validateAttachment(file('application/pdf', 1024))).toBeNull();
  });

  it('mensagem de tipo não permitido', () => {
    expect(validateAttachment(file('audio/mpeg', 1024))).toMatch(/não permitido/i);
  });

  it('mensagem de tamanho quando excede 20 MB', () => {
    expect(
      validateAttachment(file('application/pdf', ATTACHMENT_MAX_BYTES + 1)),
    ).toMatch(/20 MB/);
  });

  it('aceita exatamente no limite de 20 MB', () => {
    expect(
      validateAttachment(file('application/pdf', ATTACHMENT_MAX_BYTES)),
    ).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('formata bytes, KB e MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
