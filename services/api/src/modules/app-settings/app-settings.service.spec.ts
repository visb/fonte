import { Repository } from 'typeorm';
import { AppSettingsService } from './app-settings.service';
import { AppSettings } from './app-settings.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'settings-1', ...v })),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new AppSettingsService(repo as unknown as Repository<AppSettings>);
}

describe('AppSettingsService.get', () => {
  it('creates default settings when none exist', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.get();
    expect(repo.save).toHaveBeenCalled();
    expect(repo.create.mock.calls[0][0].dailyUsageMinutes).toBe(20);
  });

  it('returns existing settings without creating', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'settings-1', dailyUsageMinutes: 25 }) });
    const service = makeService(repo);

    const result = await service.get();
    expect(repo.save).not.toHaveBeenCalled();
    expect(result.dailyUsageMinutes).toBe(25);
  });
});

describe('AppSettingsService.getDailyLimitSeconds', () => {
  it('converts the configured minutes to seconds (25 min/day rule)', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ dailyUsageMinutes: 25 }) });
    const service = makeService(repo);
    await expect(service.getDailyLimitSeconds()).resolves.toBe(25 * 60);
  });
});

describe('AppSettingsService.update', () => {
  it('patches only the provided fields', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'settings-1', dailyUsageMinutes: 20 }) });
    const service = makeService(repo);

    await service.update({ dailyUsageMinutes: 30 } as never);
    expect(repo.save.mock.calls[0][0].dailyUsageMinutes).toBe(30);
  });
});
