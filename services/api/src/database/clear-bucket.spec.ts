import { isConfirmed, run, buildStorage, type RunDeps } from './clear-bucket';

function makeLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    messages(): string[] {
      return this.log.mock.calls.map((c: unknown[]) => c.join(' '));
    },
  };
}

function makeStorage(keys: string[], deleted = keys.length) {
  return {
    listBucketKeys: jest.fn().mockResolvedValue(keys),
    clearBucket: jest.fn().mockResolvedValue({ deleted }),
  };
}

describe('clear-bucket isConfirmed', () => {
  it('is true only when --yes is present in argv', () => {
    expect(isConfirmed(['node', 'clear-bucket.ts', '--yes'])).toBe(true);
    expect(isConfirmed(['node', 'clear-bucket.ts'])).toBe(false);
    expect(isConfirmed([])).toBe(false);
  });
});

describe('clear-bucket run', () => {
  it('exits with error before listing when AWS_S3_BUCKET_NAME is missing', async () => {
    const storage = makeStorage(['a.png']);
    const logger = makeLogger();

    const code = await run({
      storage,
      argv: ['--yes'],
      bucketName: undefined,
      endpoint: 'https://s3.test',
      logger,
    } as RunDeps);

    expect(code).toBe(1);
    expect(storage.listBucketKeys).not.toHaveBeenCalled();
    expect(storage.clearBucket).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('exits with error when the endpoint is missing', async () => {
    const storage = makeStorage(['a.png']);
    const logger = makeLogger();

    const code = await run({
      storage,
      argv: ['--yes'],
      bucketName: 'mybucket',
      endpoint: undefined,
      logger,
    } as RunDeps);

    expect(code).toBe(1);
    expect(storage.listBucketKeys).not.toHaveBeenCalled();
    expect(storage.clearBucket).not.toHaveBeenCalled();
  });

  it('dry-run (no --yes): lists count + sample, never calls clearBucket', async () => {
    const keys = Array.from({ length: 15 }, (_, i) => `obj-${i}.png`);
    const storage = makeStorage(keys);
    const logger = makeLogger();

    const code = await run({
      storage,
      argv: [],
      bucketName: 'mybucket',
      endpoint: 'https://s3.test',
      logger,
    });

    expect(code).toBe(0);
    expect(storage.listBucketKeys).toHaveBeenCalledTimes(1);
    expect(storage.clearBucket).not.toHaveBeenCalled();
    const out = logger.messages().join('\n');
    expect(out).toContain('[dry-run] 15 objeto(s)');
    expect(out).toContain('--yes');
    // Sample is capped at 10 keys.
    expect(logger.log.mock.calls.filter((c) => String(c[0]).startsWith('  - '))).toHaveLength(10);
  });

  it('reports an already-empty bucket without calling clearBucket', async () => {
    const storage = makeStorage([]);
    const logger = makeLogger();

    const code = await run({
      storage,
      argv: ['--yes'],
      bucketName: 'mybucket',
      endpoint: 'https://s3.test',
      logger,
    });

    expect(code).toBe(0);
    expect(storage.clearBucket).not.toHaveBeenCalled();
    expect(logger.messages().join('\n')).toContain('já vazio');
  });

  it('with --yes: calls clearBucket and reports the deleted count', async () => {
    const keys = ['a.png', 'b.png', 'c.png'];
    const storage = makeStorage(keys, 3);
    const logger = makeLogger();

    const code = await run({
      storage,
      argv: ['--yes'],
      bucketName: 'mybucket',
      endpoint: 'https://s3.test',
      logger,
    });

    expect(code).toBe(0);
    expect(storage.listBucketKeys).toHaveBeenCalledTimes(1);
    expect(storage.clearBucket).toHaveBeenCalledTimes(1);
    expect(logger.messages().join('\n')).toContain('3 objeto(s) apagado(s)');
  });

  it('falls back to console when no logger is provided', async () => {
    const storage = makeStorage([]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const code = await run({
      storage,
      argv: ['--yes'],
      bucketName: 'mybucket',
      endpoint: 'https://s3.test',
    });

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe('clear-bucket buildStorage', () => {
  it('constructs a StorageService from process.env', () => {
    const storage = buildStorage();
    // No S3 env in the test process → local (non-S3) mode.
    expect(storage.isS3Mode()).toBe(false);
  });
});
