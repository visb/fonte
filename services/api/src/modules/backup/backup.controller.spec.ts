import { BadRequestException } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

function makeController(svc: Partial<BackupService>) {
  return new BackupController(svc as BackupService);
}

describe('BackupController', () => {
  it('lists backups via the service', async () => {
    const listBackups = jest.fn().mockResolvedValue([{ key: 'a' }]);
    const controller = makeController({ listBackups });
    await expect(controller.list()).resolves.toEqual([{ key: 'a' }]);
    expect(listBackups).toHaveBeenCalled();
  });

  it('runs a backup when configured', async () => {
    const runBackup = jest.fn().mockResolvedValue({ skipped: false });
    const controller = makeController({ isConfigured: () => true, runBackup });
    await expect(controller.run()).resolves.toEqual({ skipped: false });
    expect(runBackup).toHaveBeenCalled();
  });

  it('rejects with 400 when backup is not configured', async () => {
    const runBackup = jest.fn();
    const controller = makeController({ isConfigured: () => false, runBackup });
    await expect(controller.run()).rejects.toThrow(BadRequestException);
    expect(runBackup).not.toHaveBeenCalled();
  });
});
