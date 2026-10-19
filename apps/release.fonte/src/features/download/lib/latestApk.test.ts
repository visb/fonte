import { jsonResponse } from '@/test/renderRoute';
import { APK_URL, fetchLatestApk, LATEST_APK_URL, versionedApkUrl } from './latestApk';

const MANIFEST = {
  version: '1.0.0',
  versionCode: 10000,
  sizeBytes: 73_400_320,
  sha256: 'abc123',
  builtAt: '2026-10-19T12:00:00Z',
};

describe('fetchLatestApk', () => {
  it('devolve o manifesto publicado, sem cache', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(MANIFEST));
    await expect(fetchLatestApk(fetcher)).resolves.toEqual(MANIFEST);
    expect(fetcher).toHaveBeenCalledWith(LATEST_APK_URL, { cache: 'no-store' });
  });

  it('404 = APK ainda não publicado (null)', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse('', 404));
    await expect(fetchLatestApk(fetcher)).resolves.toBeNull();
  });

  it('resposta que não é JSON (fallback de SPA) = não publicado', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse('<!doctype html><html></html>'));
    await expect(fetchLatestApk(fetcher)).resolves.toBeNull();
  });

  it('erro HTTP diferente de 404 lança', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse('', 500));
    await expect(fetchLatestApk(fetcher)).rejects.toThrow(/HTTP 500/);
  });

  it('manifesto malformado lança', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ version: '1.0.0' }));
    await expect(fetchLatestApk(fetcher)).rejects.toThrow(/malformado/);
  });

  it('JSON que não é objeto lança', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse('null'));
    await expect(fetchLatestApk(fetcher)).rejects.toThrow(/malformado/);
  });

  it('usa o fetch global por padrão', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(MANIFEST));
    await expect(fetchLatestApk()).resolves.toEqual(MANIFEST);
    spy.mockRestore();
  });
});

describe('URLs de download', () => {
  it('apontam para /downloads', () => {
    expect(APK_URL).toBe('/downloads/ops.apk');
    expect(versionedApkUrl('1.2.3')).toBe('/downloads/ops-1.2.3.apk');
  });
});
