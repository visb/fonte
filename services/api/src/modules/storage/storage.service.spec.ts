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

// Story 76 — content de template guarda URL canônica; assina ao servir.
describe('StorageService.canonicalizeS3Url', () => {
  it('strips the presign query from a signed S3 URL', () => {
    const svc = makeService();
    expect(svc.canonicalizeS3Url(`${BASE}/documents/doc.png?X-Amz-Signature=abc&X-Amz-Date=x`)).toBe(
      `${BASE}/documents/doc.png`,
    );
  });

  it('leaves an already-canonical S3 URL unchanged', () => {
    const svc = makeService();
    expect(svc.canonicalizeS3Url(`${BASE}/documents/doc.png`)).toBe(`${BASE}/documents/doc.png`);
  });

  it('leaves non-S3 URLs unchanged (local and external)', () => {
    const svc = makeService();
    expect(svc.canonicalizeS3Url('/uploads/documents/doc.png')).toBe('/uploads/documents/doc.png');
    expect(svc.canonicalizeS3Url('https://other.cdn/x.png?token=1')).toBe('https://other.cdn/x.png?token=1');
  });

  it('returns the URL unchanged when not in S3 mode', () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    expect(svc.canonicalizeS3Url('anything?with=query')).toBe('anything?with=query');
  });
});

describe('StorageService.stripContentSignatures', () => {
  it('canonicalizes a single signed S3 <img src>', () => {
    const svc = makeService();
    const html = `<p>x</p><img src="${BASE}/documents/doc.png?X-Amz-Signature=abc">`;
    expect(svc.stripContentSignatures(html)).toBe(`<p>x</p><img src="${BASE}/documents/doc.png">`);
  });

  it('canonicalizes every S3 image when there are many', () => {
    const svc = makeService();
    const html =
      `<img src="${BASE}/a.png?X-Amz-Signature=1">` +
      `<img src='${BASE}/b.png?X-Amz-Signature=2'>`;
    expect(svc.stripContentSignatures(html)).toBe(
      `<img src="${BASE}/a.png"><img src='${BASE}/b.png'>`,
    );
  });

  it('leaves non-S3 images and non-img S3 links untouched', () => {
    const svc = makeService();
    const html =
      `<img src="/uploads/x.png?q=1">` +
      `<a href="${BASE}/doc.png?X-Amz-Signature=z">link</a>`;
    expect(svc.stripContentSignatures(html)).toBe(html);
  });

  it('is idempotent on already-canonical content', () => {
    const svc = makeService();
    const html = `<img src="${BASE}/a.png">`;
    expect(svc.stripContentSignatures(html)).toBe(html);
  });

  it('returns empty/plain content unchanged', () => {
    const svc = makeService();
    expect(svc.stripContentSignatures('')).toBe('');
    expect(svc.stripContentSignatures('<p>no image</p>')).toBe('<p>no image</p>');
  });
});

describe('StorageService.signContentUrls', () => {
  beforeEach(() => {
    let n = 0;
    mockGetSignedUrl.mockReset();
    mockGetSignedUrl.mockImplementation(async () => `signed-${++n}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs each canonical S3 <img src> (re-signing already-signed srcs)', async () => {
    const svc = makeService();
    const html =
      `<img src="${BASE}/a.png">` +
      `<img src="${BASE}/b.png?X-Amz-Signature=old">`;
    const result = await svc.signContentUrls(html);
    // Each src replaced by a freshly signed URL (mock yields signed-1/signed-2).
    expect(result).toBe(`<img src="signed-1"><img src="signed-2">`);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('leaves non-S3 images untouched', async () => {
    const svc = makeService();
    const html = `<img src="/uploads/x.png"><img src="https://other/y.png">`;
    expect(await svc.signContentUrls(html)).toBe(html);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('returns content unchanged when not in S3 mode', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    const html = `<img src="${BASE}/a.png">`;
    expect(await svc.signContentUrls(html)).toBe(html);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('returns content with no images unchanged', async () => {
    const svc = makeService();
    expect(await svc.signContentUrls('<p>plain</p>')).toBe('<p>plain</p>');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});
