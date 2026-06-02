import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { StorageUrlInterceptor } from './storage-url.interceptor';
import { StorageService } from './storage.service';

function makeInterceptor(s3Mode: boolean): StorageUrlInterceptor {
  const storage = {
    isS3Mode: () => s3Mode,
    isS3Url: (url: string) => url.startsWith('s3://'),
    signUrl: async (url: string) => `${url}?signed`,
  } as unknown as StorageService;
  return new StorageUrlInterceptor(storage);
}

async function run(interceptor: StorageUrlInterceptor, data: unknown): Promise<unknown> {
  const next: CallHandler = { handle: () => of(data) };
  return firstValueFrom(interceptor.intercept({} as ExecutionContext, next));
}

describe('StorageUrlInterceptor', () => {
  it('preserves Date instances in S3 mode instead of turning them into {}', async () => {
    const interceptor = makeInterceptor(true);
    const date = new Date('2026-06-02T12:00:00.000Z');

    const result = (await run(interceptor, { updatedAt: date })) as { updatedAt: Date };

    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.updatedAt.toISOString()).toBe('2026-06-02T12:00:00.000Z');
  });

  it('still signs s3 urls and recurses into nested plain objects/arrays', async () => {
    const interceptor = makeInterceptor(true);

    const result = (await run(interceptor, {
      items: [{ fileUrl: 's3://bucket/a.png', createdAt: new Date('2026-01-01T00:00:00.000Z') }],
    })) as { items: { fileUrl: string; createdAt: Date }[] };

    expect(result.items[0].fileUrl).toBe('s3://bucket/a.png?signed');
    expect(result.items[0].createdAt).toBeInstanceOf(Date);
  });

  it('returns data untouched when not in S3 mode', async () => {
    const interceptor = makeInterceptor(false);
    const payload = { fileUrl: 's3://bucket/a.png', updatedAt: new Date() };

    const result = await run(interceptor, payload);

    expect(result).toBe(payload);
  });
});
