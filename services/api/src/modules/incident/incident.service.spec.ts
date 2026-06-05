import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IncidentService } from './incident.service';
import { Incident } from './incident.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'inc-1', ...v })),
    ...overrides,
  };
}

function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) };
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  notifications = makeNotifications(),
) {
  return new IncidentService(
    repo as unknown as Repository<Incident>,
    notifications as never,
  );
}

describe('IncidentService.findAll', () => {
  it('filters by houseId and residentId when provided', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.findAll('house-1', 'res-1');

    expect(repo.find.mock.calls[0][0].where).toEqual({ houseId: 'house-1', residentId: 'res-1' });
  });

  it('uses an empty filter when no scope is given', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.findAll();

    expect(repo.find.mock.calls[0][0].where).toEqual({});
  });
});

describe('IncidentService.findOne', () => {
  it('throws NotFound when missing', async () => {
    const service = makeService(makeRepo());
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the incident when found', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'inc-1' }) });
    const service = makeService(repo);
    await expect(service.findOne('inc-1')).resolves.toEqual({ id: 'inc-1' });
  });
});

describe('IncidentService.create', () => {
  it('persists the incident (incidents are never deleted)', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.create({ houseId: 'house-1', date: '2026-06-01', description: 'x' } as never);

    expect(repo.save).toHaveBeenCalled();
    // No delete/softDelete is exposed by the service — incidents are immutable history.
    expect((service as unknown as Record<string, unknown>).remove).toBeUndefined();
  });
});
