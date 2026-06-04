import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResidentSessionService } from './resident-session.service';
import { ResidentUsageSession } from './resident-usage-session.entity';
import { Resident } from '../resident/resident.entity';
import { AppSettingsService } from '../app-settings/app-settings.service';

const LIMIT = 1500; // 25 min/day

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    query: jest.fn().mockResolvedValue([{ seconds_used: 0 }]),
    ...overrides,
  };
}

function makeService(sessionRepo: ReturnType<typeof makeRepo>, residentRepo = makeRepo()) {
  const appSettings = { getDailyLimitSeconds: jest.fn().mockResolvedValue(LIMIT) } as unknown as AppSettingsService;
  return new ResidentSessionService(
    sessionRepo as unknown as Repository<ResidentUsageSession>,
    residentRepo as unknown as Repository<Resident>,
    appSettings,
  );
}

describe('ResidentSessionService.getToday', () => {
  it('returns zero usage when there is no session yet', async () => {
    const service = makeService(makeRepo());
    await expect(service.getToday('res-1')).resolves.toEqual({ secondsUsed: 0, limitSeconds: LIMIT });
  });
});

describe('ResidentSessionService.getTodayByUserId', () => {
  it('throws NotFound when the resident profile is missing', async () => {
    const residentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), residentRepo);
    await expect(service.getTodayByUserId('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ResidentSessionService.addSeconds', () => {
  it('clamps the increment to the daily limit', async () => {
    const sessionRepo = makeRepo({ query: jest.fn().mockResolvedValue([{ seconds_used: LIMIT }]) });
    const residentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1' }) });
    const service = makeService(sessionRepo, residentRepo);

    await service.addSeconds('user-1', 99999);

    // Fourth positional arg ($4) is the cap; third ($3) is the clamped increment.
    const params = sessionRepo.query.mock.calls[0][1];
    expect(params[2]).toBe(LIMIT);
    expect(params[3]).toBe(LIMIT);
  });

  it('floors a negative increment at zero', async () => {
    const sessionRepo = makeRepo();
    const residentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1' }) });
    const service = makeService(sessionRepo, residentRepo);

    await service.addSeconds('user-1', -50);
    expect(sessionRepo.query.mock.calls[0][1][2]).toBe(0);
  });

  it('throws NotFound when the resident profile is missing', async () => {
    const residentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), residentRepo);
    await expect(service.addSeconds('user-1', 10)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ResidentSessionService.reset', () => {
  it('zeroes an existing session', async () => {
    const sessionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'sess-1' }) });
    const service = makeService(sessionRepo);
    await service.reset('res-1');
    expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', { secondsUsed: 0 });
  });

  it('does nothing when there is no session', async () => {
    const sessionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(sessionRepo);
    await service.reset('res-1');
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });
});
