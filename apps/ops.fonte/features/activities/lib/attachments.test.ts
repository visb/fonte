import {
  ATTACHMENT_MAX_BYTES,
  formatFileSize,
  isAllowedAttachment,
  validateAttachment,
} from './attachments';

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
    expect(isAllowedAttachment(type)).toBe(true);
  });

  it.each(['application/x-msdownload', 'audio/mpeg', 'video/mp4', 'text/html'])(
    'rejeita %s (fora da allowlist; sem áudio nesta story)',
    (type) => {
      expect(isAllowedAttachment(type)).toBe(false);
    },
  );
});

describe('validateAttachment', () => {
  it('null para arquivo válido', () => {
    expect(validateAttachment('application/pdf', 1024)).toBeNull();
  });

  it('mensagem de tipo não permitido', () => {
    expect(validateAttachment('audio/mpeg', 1024)).toMatch(/não permitido/i);
  });

  it('mensagem de tamanho quando excede 20 MB', () => {
    expect(validateAttachment('application/pdf', ATTACHMENT_MAX_BYTES + 1)).toMatch(
      /20 MB/,
    );
  });

  it('sem size informado só valida o tipo (backend ainda barra tamanho)', () => {
    expect(validateAttachment('application/pdf')).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('formata bytes, KB e MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
