import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const ENDPOINT = 'https://s3.test';
const BUCKET = 'mybucket';
const BASE = `${ENDPOINT}/${BUCKET}`;

function makeService(overrides: Record<string, unknown> = {}): StorageService {
  const values: Record<string, unknown> = {
    AWS_S3_BUCKET_NAME: BUCKET,
    AWS_ENDPOINT_URL: ENDPOINT,
    AWS_DEFAULT_REGION: 'auto',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    ...overrides,
  };
  const config = {
    get: (k: string) => values[k],
  } as unknown as ConfigService;
  return new StorageService(config);
}

describe('StorageService signed URL cache', () => {
  beforeEach(() => {
    let n = 0;
    mockGetSignedUrl.mockReset();
    // Each sign produces a distinct URL so re-signs are detectable.
    mockGetSignedUrl.mockImplementation(async () => `signed-${++n}`);
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const url = `${BASE}/residents/a.png`;

  it('returns the same signed URL on repeated calls within the reuse window', async () => {
    const svc = makeService();

    const first = await svc.signUrl(url);
    const second = await svc.signUrl(url);

    expect(first).toBe('signed-1');
    expect(second).toBe('signed-1');
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('re-signs after the cached entry expires', async () => {
    const svc = makeService();

    const first = await svc.signUrl(url);
    // Advance past the 12h reuse window.
    (Date.now as jest.Mock).mockReturnValue(1_000_000 + 13 * 60 * 60 * 1000);
    const second = await svc.signUrl(url);

    expect(first).toBe('signed-1');
    expect(second).toBe('signed-2');
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('caps the cache size and evicts the oldest entry (LRU)', async () => {
    const svc = makeService({ SIGNED_URL_CACHE_MAX: 2 });

    await svc.signUrl(`${BASE}/a.png`);
    await svc.signUrl(`${BASE}/b.png`);
    await svc.signUrl(`${BASE}/c.png`); // evicts a.png

    const cache = (svc as unknown as { urlCache: Map<string, unknown> }).urlCache;
    expect(cache.size).toBe(2);
    expect(cache.has(`${BASE}/a.png`)).toBe(false);
    expect(cache.has(`${BASE}/b.png`)).toBe(true);
    expect(cache.has(`${BASE}/c.png`)).toBe(true);
  });

  it('sweepExpiredUrls removes only expired entries and returns the count', async () => {
    const svc = makeService();

    await svc.signUrl(`${BASE}/old.png`);
    // Advance so old.png is expired, then add a fresh entry.
    (Date.now as jest.Mock).mockReturnValue(1_000_000 + 13 * 60 * 60 * 1000);
    await svc.signUrl(`${BASE}/fresh.png`);

    const removed = svc.sweepExpiredUrls();

    const cache = (svc as unknown as { urlCache: Map<string, unknown> }).urlCache;
    expect(removed).toBe(1);
    expect(cache.has(`${BASE}/old.png`)).toBe(false);
    expect(cache.has(`${BASE}/fresh.png`)).toBe(true);
  });

  it('does not cache or sign when not in S3 mode', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });

    const result = await svc.signUrl('/uploads/residents/a.png');

    expect(result).toBe('/uploads/residents/a.png');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});
