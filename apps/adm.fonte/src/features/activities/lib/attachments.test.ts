import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  AUDIO_MAX_DURATION_SECONDS,
  formatDuration,
  formatFileSize,
  isAllowedAttachment,
  isAudioMimetype,
  validateAttachment,
  validateAudioDuration,
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
    // áudio (story 74)
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
  ])('aceita %s', (type) => {
    expect(isAllowedAttachment(file(type, 10))).toBe(true);
  });

  it.each(['application/x-msdownload', 'audio/flac', 'video/mp4', 'text/html'])(
    'rejeita %s (fora da allowlist)',
    (type) => {
      expect(isAllowedAttachment(file(type, 10))).toBe(false);
    },
  );
});

describe('isAudioMimetype', () => {
  it.each(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/anything'])(
    'reconhece %s como áudio',
    (type) => {
      expect(isAudioMimetype(type)).toBe(true);
    },
  );

  it.each(['image/png', 'application/pdf'])('não é áudio: %s', (type) => {
    expect(isAudioMimetype(type)).toBe(false);
  });
});

describe('validateAttachment', () => {
  it('null para arquivo válido', () => {
    expect(validateAttachment(file('application/pdf', 1024))).toBeNull();
  });

  it('null para áudio dentro do limite (story 74)', () => {
    expect(validateAttachment(file('audio/webm', 1024))).toBeNull();
  });

  it('mensagem de tipo não permitido', () => {
    expect(validateAttachment(file('audio/flac', 1024))).toMatch(/não permitido/i);
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

describe('validateAudioDuration', () => {
  it('null dentro do limite de 2 minutos', () => {
    expect(validateAudioDuration(AUDIO_MAX_DURATION_SECONDS)).toBeNull();
    expect(validateAudioDuration(30)).toBeNull();
  });

  it('mensagem quando excede 2 minutos', () => {
    expect(validateAudioDuration(AUDIO_MAX_DURATION_SECONDS + 1)).toMatch(
      /2 minutos/,
    );
  });
});

describe('formatDuration', () => {
  it('formata segundos como mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(120)).toBe('2:00');
  });

  it('protege contra valores inválidos', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-3)).toBe('0:00');
  });
});

describe('formatFileSize', () => {
  it('formata bytes, KB e MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
