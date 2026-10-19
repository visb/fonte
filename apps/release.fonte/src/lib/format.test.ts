import { formatBytes, formatDate } from './format';
import { queryKeys } from './queryKeys';

describe('formatDate', () => {
  it('converte ISO para dd/mm/aaaa sem depender de fuso', () => {
    expect(formatDate('2026-10-20')).toBe('20/10/2026');
  });
});

describe('formatBytes', () => {
  it('formata megabytes com vírgula decimal', () => {
    expect(formatBytes(73_400_320)).toBe('70,0 MB');
  });

  it('formata arquivos pequenos em KB (mínimo 1 KB)', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(10)).toBe('1 KB');
  });
});

describe('queryKeys', () => {
  it('expõe a chave do manifesto do APK', () => {
    expect(queryKeys.latestApk).toEqual(['latest-apk']);
  });
});
