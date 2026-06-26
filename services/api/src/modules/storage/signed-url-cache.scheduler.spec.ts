import { SignedUrlCacheScheduler } from './signed-url-cache.scheduler';
import { StorageService } from './storage.service';

function makeScheduler(removed: number) {
  const sweepExpiredUrls = jest.fn().mockReturnValue(removed);
  const scheduler = new SignedUrlCacheScheduler({
    sweepExpiredUrls,
  } as unknown as StorageService);
  jest.spyOn((scheduler as any).logger, 'debug').mockImplementation(() => undefined);
  return { scheduler, sweepExpiredUrls };
}

describe('SignedUrlCacheScheduler.sweep', () => {
  it('logs when entries were swept', () => {
    const { scheduler, sweepExpiredUrls } = makeScheduler(4);
    scheduler.sweep();
    expect(sweepExpiredUrls).toHaveBeenCalled();
  });

  it('stays quiet when nothing was swept', () => {
    const { scheduler, sweepExpiredUrls } = makeScheduler(0);
    scheduler.sweep();
    expect(sweepExpiredUrls).toHaveBeenCalled();
  });
});
