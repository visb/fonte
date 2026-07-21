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

describe('StorageService.extractBucketImageUrls (story 93)', () => {
  it('returns only canonical bucket image urls', () => {
    const svc = makeService();
    const html =
      `<img src="${BASE}/documents/a.png?X-Amz-Signature=z">` +
      `<img src="https://other/x.png">` +
      `<img src="/uploads/local.png">`;
    expect(svc.extractBucketImageUrls(html)).toEqual([`${BASE}/documents/a.png`]);
  });

  it('returns [] outside S3 mode', () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    expect(svc.extractBucketImageUrls(`<img src="${BASE}/a.png">`)).toEqual([]);
  });
});

describe('StorageService.keyFromUrl (story 93)', () => {
  it('maps a canonical bucket url to its object key', () => {
    const svc = makeService();
    expect(svc.keyFromUrl(`${BASE}/documents/a.png`)).toBe('documents/a.png');
  });

  it('strips a presign query before mapping', () => {
    const svc = makeService();
    expect(svc.keyFromUrl(`${BASE}/documents/a.png?X-Amz-Signature=z`)).toBe('documents/a.png');
  });

  it('returns null for non-bucket urls and nullish input', () => {
    const svc = makeService();
    expect(svc.keyFromUrl('/uploads/x.png')).toBeNull();
    expect(svc.keyFromUrl('https://other/x.png')).toBeNull();
    expect(svc.keyFromUrl(null)).toBeNull();
    expect(svc.keyFromUrl(undefined)).toBeNull();
  });

  it('returns null outside S3 mode', () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    expect(svc.keyFromUrl(`${BASE}/a.png`)).toBeNull();
  });
});

describe('StorageService.listBucketKeys (story 93)', () => {
  it('paginates ListObjectsV2 and returns every key', async () => {
    const svc = makeService();
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'a.png' }, { Key: 'b.png' }, {}],
        IsTruncated: true,
        NextContinuationToken: 'tok',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'c.png' }],
        IsTruncated: false,
      });
    (svc as unknown as { s3: { send: jest.Mock } }).s3 = { send };

    const keys = await svc.listBucketKeys();

    expect(keys).toEqual(['a.png', 'b.png', 'c.png']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns [] outside S3 mode', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    expect(await svc.listBucketKeys()).toEqual([]);
  });
});

describe('StorageService.clearBucket (story 123)', () => {
  it('deletes every object in batches of 1000 and returns the total (N > 1000)', async () => {
    const svc = makeService();
    const N = 2300;
    const allKeys = Array.from({ length: N }, (_, i) => `obj-${i}.png`);
    // listBucketKeys paginates: two ListObjectsV2 pages, then delete batches.
    const send = jest
      .fn()
      // ListObjectsV2 — page 1 (first 1500 keys)
      .mockResolvedValueOnce({
        Contents: allKeys.slice(0, 1500).map((Key) => ({ Key })),
        IsTruncated: true,
        NextContinuationToken: 'tok',
      })
      // ListObjectsV2 — page 2 (remaining keys)
      .mockResolvedValueOnce({
        Contents: allKeys.slice(1500).map((Key) => ({ Key })),
        IsTruncated: false,
      })
      // DeleteObjects — three batches (1000, 1000, 300)
      .mockResolvedValue({});
    (svc as unknown as { s3: { send: jest.Mock } }).s3 = { send };

    const { deleted } = await svc.clearBucket();

    expect(deleted).toBe(N);
    // 2 list calls + 3 delete calls.
    expect(send).toHaveBeenCalledTimes(5);
    const deleteCalls = send.mock.calls
      .map(([cmd]) => cmd)
      .filter((cmd) => cmd.constructor.name === 'DeleteObjectsCommand');
    expect(deleteCalls).toHaveLength(3);
    expect(deleteCalls[0].input.Delete.Objects).toHaveLength(1000);
    expect(deleteCalls[1].input.Delete.Objects).toHaveLength(1000);
    expect(deleteCalls[2].input.Delete.Objects).toHaveLength(300);
    // Every key is covered exactly once, in order.
    const sentKeys = deleteCalls.flatMap((cmd) =>
      cmd.input.Delete.Objects.map((o: { Key: string }) => o.Key),
    );
    expect(sentKeys).toEqual(allKeys);
  });

  it('is a no-op on an empty bucket (deleted === 0, no DeleteObjects sent)', async () => {
    const svc = makeService();
    const send = jest.fn().mockResolvedValueOnce({ Contents: [], IsTruncated: false });
    (svc as unknown as { s3: { send: jest.Mock } }).s3 = { send };

    const { deleted } = await svc.clearBucket();

    expect(deleted).toBe(0);
    // Only the single ListObjectsV2 call; no delete attempted.
    expect(send).toHaveBeenCalledTimes(1);
    const deleteCalls = send.mock.calls
      .map(([cmd]) => cmd)
      .filter((cmd) => cmd.constructor.name === 'DeleteObjectsCommand');
    expect(deleteCalls).toHaveLength(0);
  });

  it('is a no-op outside S3 mode (deleted === 0)', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    expect(await svc.clearBucket()).toEqual({ deleted: 0 });
  });

  it('logs and continues when a batch fails (best-effort, does not throw)', async () => {
    const svc = makeService();
    const allKeys = Array.from({ length: 1500 }, (_, i) => `obj-${i}.png`);
    const send = jest
      .fn()
      // single ListObjectsV2 page
      .mockResolvedValueOnce({
        Contents: allKeys.map((Key) => ({ Key })),
        IsTruncated: false,
      })
      // first delete batch throws, second succeeds
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    (svc as unknown as { s3: { send: jest.Mock } }).s3 = { send };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { deleted } = await svc.clearBucket();

    // First batch (1000) failed → not counted; second batch (500) succeeded.
    expect(deleted).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('subtracts per-object Errors reported by DeleteObjects from the count', async () => {
    const svc = makeService();
    const allKeys = Array.from({ length: 3 }, (_, i) => `obj-${i}.png`);
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: allKeys.map((Key) => ({ Key })),
        IsTruncated: false,
      })
      .mockResolvedValueOnce({ Errors: [{ Key: 'obj-1.png' }] });
    (svc as unknown as { s3: { send: jest.Mock } }).s3 = { send };

    const { deleted } = await svc.clearBucket();

    expect(deleted).toBe(2);
  });
});

// Story 135 — em modo local (não-S3) a assinatura tem URL relativa /uploads/...
// que o puppeteer não resolve (setContent sem base URL). toDataUri inline o
// arquivo como data URI para o <img> renderizar em qualquer ambiente local.
describe('StorageService.toDataUri (story 135)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inlines a local /uploads png as a data URI in non-S3 mode (reusing download)', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    const buffer = Buffer.from('PNGBYTES');
    const download = jest.spyOn(svc, 'download').mockResolvedValue(buffer);

    const result = await svc.toDataUri('/uploads/signatures/x.png');

    expect(download).toHaveBeenCalledWith('/uploads/signatures/x.png');
    expect(result).toBe(`data:image/png;base64,${buffer.toString('base64')}`);
  });

  it('infers mime by extension (.jpg/.jpeg → image/jpeg, .webp → image/webp)', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    jest.spyOn(svc, 'download').mockResolvedValue(Buffer.from('X'));

    expect(await svc.toDataUri('/uploads/a.jpg')).toContain('data:image/jpeg;base64,');
    expect(await svc.toDataUri('/uploads/a.jpeg')).toContain('data:image/jpeg;base64,');
    expect(await svc.toDataUri('/uploads/a.webp')).toContain('data:image/webp;base64,');
  });

  it('falls back to application/octet-stream for an unknown extension', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    jest.spyOn(svc, 'download').mockResolvedValue(Buffer.from('X'));

    expect(await svc.toDataUri('/uploads/a.bin')).toContain('data:application/octet-stream;base64,');
  });

  it('returns the URL unchanged in S3 mode (never inlines)', async () => {
    const svc = makeService();
    const download = jest.spyOn(svc, 'download');

    expect(await svc.toDataUri('/uploads/x.png')).toBe('/uploads/x.png');
    expect(download).not.toHaveBeenCalled();
  });

  it('returns absolute/external URLs unchanged in non-S3 mode', async () => {
    const svc = makeService({ AWS_S3_BUCKET_NAME: undefined, AWS_ENDPOINT_URL: undefined });
    const download = jest.spyOn(svc, 'download');

    expect(await svc.toDataUri('https://cdn.test/x.png')).toBe('https://cdn.test/x.png');
    expect(download).not.toHaveBeenCalled();
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
