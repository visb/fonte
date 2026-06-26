import { BackupScheduler } from './backup.scheduler';
import { BackupService } from './backup.service';

function makeScheduler(svc: Partial<BackupService>) {
  const scheduler = new BackupScheduler(svc as BackupService);
  // silence logger
  jest.spyOn((scheduler as any).logger, 'log').mockImplementation(() => undefined);
  jest.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
  return scheduler;
}

describe('BackupScheduler.weeklyBackup', () => {
  it('does nothing when backup is disabled', async () => {
    const runBackup = jest.fn();
    const scheduler = makeScheduler({ isEnabled: () => false, runBackup });
    await scheduler.weeklyBackup();
    expect(runBackup).not.toHaveBeenCalled();
  });

  it('logs and returns when the run is skipped', async () => {
    const runBackup = jest.fn().mockResolvedValue({ skipped: true, reason: 'lock held' });
    const scheduler = makeScheduler({ isEnabled: () => true, runBackup });
    await scheduler.weeklyBackup();
    expect(runBackup).toHaveBeenCalled();
  });

  it('logs a summary on success', async () => {
    const runBackup = jest.fn().mockResolvedValue({
      skipped: false,
      dumpKey: 'dump-1.sql',
      filesCopied: 3,
      filesTotal: 3,
      prunedDumps: ['old.sql'],
    });
    const scheduler = makeScheduler({ isEnabled: () => true, runBackup });
    await scheduler.weeklyBackup();
    expect(runBackup).toHaveBeenCalled();
  });

  it('logs and rethrows on failure', async () => {
    const runBackup = jest.fn().mockRejectedValue(new Error('boom'));
    const scheduler = makeScheduler({ isEnabled: () => true, runBackup });
    await expect(scheduler.weeklyBackup()).rejects.toThrow('boom');
  });
});
