import { StoreroomUsageScheduler } from './storeroom-usage.scheduler';
import { StoreroomService } from './storeroom.service';

function makeScheduler(consolidate: jest.Mock) {
  const scheduler = new StoreroomUsageScheduler({
    consolidateWeeklyAverageUsage: consolidate,
  } as unknown as StoreroomService);
  jest.spyOn((scheduler as any).logger, 'log').mockImplementation(() => undefined);
  jest.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
  return scheduler;
}

describe('StoreroomUsageScheduler.consolidateWeeklyAverageUsage', () => {
  it('logs a skip when another instance holds the lock', async () => {
    const consolidate = jest.fn().mockResolvedValue({ skipped: true });
    const scheduler = makeScheduler(consolidate);
    await scheduler.consolidateWeeklyAverageUsage();
    expect(consolidate).toHaveBeenCalled();
  });

  it('logs the result on success', async () => {
    const consolidate = jest.fn().mockResolvedValue({
      skipped: false,
      updatedItems: 5,
      windowStart: '2026-01-01',
      windowEnd: '2026-01-07',
    });
    const scheduler = makeScheduler(consolidate);
    await scheduler.consolidateWeeklyAverageUsage();
    expect(consolidate).toHaveBeenCalled();
  });

  it('logs and rethrows on failure', async () => {
    const consolidate = jest.fn().mockRejectedValue(new Error('db down'));
    const scheduler = makeScheduler(consolidate);
    await expect(scheduler.consolidateWeeklyAverageUsage()).rejects.toThrow('db down');
  });
});
