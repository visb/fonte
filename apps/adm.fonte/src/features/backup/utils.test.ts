import { describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime } from './utils';

describe('formatBytes', () => {
  it('zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('bytes sem casa decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('KB, MB, GB com uma casa', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('valor fracionário arredonda a uma casa', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatDateTime', () => {
  it('formata ISO em pt-BR data+hora curtas', () => {
    const out = formatDateTime('2026-06-07T04:00:00.000Z');
    // contém data e separador de hora; formato exato depende do TZ do runner
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });
});
